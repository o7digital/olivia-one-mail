import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import { getMailcowConnectionConfig, resolveFromName, type MailboxCredentials, type MailcowConnectionConfig } from '../services/mailcowAuth.js'
import { computeReplyAllRecipients } from '../services/mailRecipients.js'
import type { Folder, MailAttachment, MailMessage, MailPage } from '../types/domain.js'
import type { MailProvider } from './mailProvider.js'

interface OutgoingMessage {
  from: string | { name: string; address: string }
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text: string
}

const SPECIAL_USE_LABELS: Record<string, string> = {
  '\\Inbox': 'Inbox', '\\Sent': 'Sent', '\\Drafts': 'Drafts', '\\Trash': 'Trash',
  '\\Archive': 'Archive', '\\Junk': 'Spam',
}

function folderLabel(mailbox: { path: string; specialUse?: string }) {
  if (mailbox.path.toUpperCase() === 'INBOX') return 'Inbox'
  return (mailbox.specialUse && SPECIAL_USE_LABELS[mailbox.specialUse]) || mailbox.path
}

function encodeMessageId(mailbox: string, uid: number) {
  return `m_${Buffer.from(mailbox, 'utf8').toString('base64url')}_${uid}`
}

function decodeMessageId(id: string) {
  const match = /^m_([A-Za-z0-9_-]+)_(\d+)$/.exec(id)
  if (!match) return { mailbox: 'INBOX', uid: id }
  return { mailbox: Buffer.from(match[1], 'base64url').toString('utf8'), uid: match[2] }
}

function decodeText(value: unknown) {
  if (typeof value === 'string') return value
  return ''
}

function sandboxHtml(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:">`
  return `${policy}${value}`
}

function formatAttachmentMeta(size: number | undefined, contentType: string | undefined) {
  const mime = contentType || 'application/octet-stream'
  const bytes = size ?? 0
  const kb = bytes / 1024
  const sizeLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(kb, 1).toFixed(kb >= 100 ? 0 : 1)} KB`
  return `${mime} · ${sizeLabel}`
}

function mapAttachment(contentType: string | undefined): Pick<MailAttachment, 'type' | 'tone'> {
  const mime = (contentType || '').toLowerCase()
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return { type: 'spreadsheet', tone: 'green' }
  if (mime.includes('pdf')) return { type: 'report', tone: 'blue' }
  return { type: 'document', tone: 'purple' }
}

function mapAddressList(list: Array<{ address?: string }> | undefined): string[] {
  return (list ?? []).map((entry) => entry.address).filter((address): address is string => Boolean(address))
}

// User labels are stored as real IMAP keywords so they persist on the mail
// server itself (no extra database needed). The display name is base64url
// encoded to keep the flag a valid IMAP atom while preserving any characters
// (spaces, accents, emoji) losslessly.
const LABEL_FLAG_PREFIX = 'OL-'

function encodeLabelFlag(label: string): string {
  return `${LABEL_FLAG_PREFIX}${Buffer.from(label, 'utf8').toString('base64url')}`
}

function decodeLabelFlag(flag: string): string | null {
  if (!flag.startsWith(LABEL_FLAG_PREFIX)) return null
  try {
    const decoded = Buffer.from(flag.slice(LABEL_FLAG_PREFIX.length), 'base64url').toString('utf8')
    return decoded || null
  } catch {
    return null
  }
}

function decodeLabelsFromFlags(flags: Set<string> | undefined): string[] {
  if (!flags) return []
  const labels: string[] = []
  for (const flag of flags) {
    const label = decodeLabelFlag(flag)
    if (label) labels.push(label)
  }
  return labels.sort((a, b) => a.localeCompare(b))
}

export class MailcowImapProvider implements MailProvider {
  private config: MailcowConnectionConfig
  private credentials: MailboxCredentials

  constructor(credentials: MailboxCredentials, config = getMailcowConnectionConfig()) {
    this.credentials = credentials
    this.config = config
  }

  private createImapClient() {
    return new ImapFlow({
    logger: false,
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapSecure,
      auth: {
        user: this.credentials.email,
        pass: this.credentials.password,
      },
    })
  }

  private createTransport() {
    return nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      requireTLS: !this.config.smtpSecure,
      auth: {
        user: this.credentials.email,
        pass: this.credentials.password,
      },
    })
  }

  private get fromAddress() {
    return {
      name: resolveFromName(this.credentials.email, this.config),
      address: this.credentials.email,
    }
  }

  private async appendToSent(rawMessage: Buffer) {
    const client = this.createImapClient()
    await client.connect()
    try {
      const mailboxes = await client.list()
      const sentMailbox = mailboxes.find((mailbox: { specialUse?: string }) => mailbox.specialUse === '\\Sent')
        ?? mailboxes.find((mailbox: { path: string }) => mailbox.path.toLowerCase() === 'sent')
      const sentPath = sentMailbox?.path ?? 'Sent'

      if (!sentMailbox) await client.mailboxCreate(sentPath)
      await client.append(sentPath, rawMessage, ['\\Seen'], new Date())
    } finally {
      await client.logout().catch(() => {})
    }
  }

  private async sendAndArchive(message: OutgoingMessage) {
    // Build the MIME message once so the SMTP delivery and the IMAP copy have
    // the same Message-ID and contents.
    const compiler = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'unix',
    })
    const compiled = await compiler.sendMail(message)
    const rawMessage = Buffer.isBuffer(compiled.message)
      ? compiled.message
      : Buffer.from(compiled.message)

    const transport = this.createTransport()
    const info = await transport.sendMail({
      envelope: compiled.envelope,
      raw: rawMessage,
    })
    await this.appendToSent(rawMessage)
    return info
  }

  async listFolders(): Promise<Folder[]> {
    const client = this.createImapClient()
    await client.connect()
    try {
      const mailboxes = await client.list()
      const counts = new Map<string, number>()
      for (const mailbox of mailboxes) {
        try {
          const status = await client.status(mailbox.path, { messages: true })
          counts.set(mailbox.path, status.messages ?? 0)
        } catch {
          counts.set(mailbox.path, 0)
        }
      }

      const order = ['Inbox', 'Sent', 'Drafts', 'Trash', 'Archive', 'Spam']
      return mailboxes
        .filter((mailbox: { flags?: Set<string> }) => !mailbox.flags?.has('\\Noselect'))
        .map((mailbox: { path: string; specialUse?: string }) => ({ label: folderLabel(mailbox), count: counts.get(mailbox.path) ?? 0 }))
        .sort((a: Folder, b: Folder) => {
          const ai = order.indexOf(a.label); const bi = order.indexOf(b.label)
          if (ai >= 0 || bi >= 0) return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi)
          return a.label.localeCompare(b.label)
        })
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async listMessages(folder: string): Promise<MailMessage[]> {
    return (await this.listMessagePage(folder, 1, 25)).messages
  }

  async listMessagePage(folder: string, page: number, pageSize: number): Promise<MailPage> {
    const client = this.createImapClient()
    await client.connect()
    try {
      const mailboxes = await client.list()
      const selected = mailboxes.find((mailbox: { path: string; specialUse?: string }) => folderLabel(mailbox).toLowerCase() === folder.toLowerCase() || mailbox.path.toLowerCase() === folder.toLowerCase())
      if (!selected) return { messages: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
      const mailbox = selected.path
      await client.mailboxOpen(mailbox)
      const total = client.mailbox.exists || 0
      if (!total) return { messages: [], pagination: { page, pageSize, total, totalPages: 0 } }

      const end = Math.max(total - (page - 1) * pageSize, 0)
      if (!end) return { messages: [], pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
      const start = Math.max(end - pageSize + 1, 1)
      const rows: MailMessage[] = []

      for await (const message of client.fetch(`${start}:${end}`, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        source: { maxLength: 1024 * 1024 * 3 },
      })) {
        const parsed = message.source ? await simpleParser(message.source) : null
        const from = message.envelope?.from?.[0]
        const email = from?.address || this.credentials.email
        const isAuthenticatedMailbox = email.toLowerCase() === this.credentials.email.toLowerCase()
        const name = isAuthenticatedMailbox
          ? this.fromAddress.name
          : (from?.name || email)
        const date = message.internalDate ?? new Date()
        const bodyText = decodeText(parsed?.text).trim()
        const preview = bodyText.split('\n').find(Boolean)?.slice(0, 160) ?? 'No preview available.'
        const attachments = (parsed?.attachments ?? []).map((attachment: {
          contentType?: string
          filename?: string
          size?: number
        }) => {
          const mapped = mapAttachment(attachment.contentType)
          return {
            type: mapped.type,
            tone: mapped.tone,
            title: attachment.filename || 'Attachment',
            sub: attachment.contentType || 'application/octet-stream',
            meta: formatAttachmentMeta(attachment.size, attachment.contentType),
          }
        })

        rows.push({
          id: encodeMessageId(mailbox, message.uid),
          folder,
          sender: name,
          initials: name.split(/\s+/).slice(0, 2).map((part: string) => part[0] ?? '').join('').toUpperCase() || 'OO',
          time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          receivedAt: date.toISOString(),
          unread: !message.flags?.has('\\Seen'),
          starred: Boolean(message.flags?.has('\\Flagged')),
          tone: 'cyan',
          email,
          role: '',
          company: email.split('@')[1] ?? '',
          subject: message.envelope?.subject || '(No subject)',
          preview,
          body: bodyText ? bodyText.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 24) : ['No body preview available.'],
          bodyHtml: sandboxHtml(parsed?.html),
          attachments,
          to: mapAddressList(message.envelope?.to),
          cc: mapAddressList(message.envelope?.cc),
          labels: decodeLabelsFromFlags(message.flags),
        })
      }

      return { messages: rows.reverse(), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async getMessage(id: string): Promise<MailMessage | null> {
    const { mailbox, uid } = decodeMessageId(id)
    const client = this.createImapClient()
    await client.connect()
    try {
      const mailboxes = await client.list()
      const selected = mailboxes.find((entry: { path: string }) => entry.path === mailbox)
      if (!selected) return null
      const label = folderLabel(selected)
      await client.mailboxOpen(mailbox)
      const message = await client.fetchOne(uid, { uid: true, envelope: true, flags: true, internalDate: true, source: { maxLength: 1024 * 1024 * 3 } }, { uid: true })
      if (!message) return null
      const parsed = message.source ? await simpleParser(message.source) : null
      const from = message.envelope?.from?.[0]
      const email = from?.address || this.credentials.email
      const isAuthenticatedMailbox = email.toLowerCase() === this.credentials.email.toLowerCase()
      const name = isAuthenticatedMailbox ? this.fromAddress.name : (from?.name || email)
      const date = message.internalDate ?? new Date()
      const bodyText = decodeText(parsed?.text).trim()
      const attachments = (parsed?.attachments ?? []).map((attachment: { contentType?: string; filename?: string; size?: number }) => {
        const mapped = mapAttachment(attachment.contentType)
        return { type: mapped.type, tone: mapped.tone, title: attachment.filename || 'Attachment', sub: attachment.contentType || 'application/octet-stream', meta: formatAttachmentMeta(attachment.size, attachment.contentType) }
      })
      return {
        id: encodeMessageId(mailbox, message.uid), folder: label, sender: name,
        initials: name.split(/\s+/).slice(0, 2).map((part: string) => part[0] ?? '').join('').toUpperCase() || 'OO',
        time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), receivedAt: date.toISOString(),
        unread: !message.flags?.has('\\Seen'), starred: Boolean(message.flags?.has('\\Flagged')), tone: 'cyan', email, role: '', company: email.split('@')[1] ?? '',
        subject: message.envelope?.subject || '(No subject)', preview: bodyText.split('\n').find(Boolean)?.slice(0, 160) ?? 'No preview available.',
        body: bodyText ? bodyText.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 200) : ['No body preview available.'], bodyHtml: sandboxHtml(parsed?.html), attachments,
        to: mapAddressList(message.envelope?.to), cc: mapAddressList(message.envelope?.cc), labels: decodeLabelsFromFlags(message.flags),
      }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async sendMessage(input: { to: string; cc?: string; bcc?: string; subject: string; body: string }) {
    const info = await this.sendAndArchive({
      from: this.fromAddress,
      to: input.to,
      cc: input.cc?.trim() || undefined,
      bcc: input.bcc?.trim() || undefined,
      subject: input.subject,
      text: input.body,
    })
    return { id: info.messageId, status: 'sent' }
  }

  async reply(id: string, input: { body: string }) {
    const original = await this.getMessage(id)
    if (!original) throw new Error('Message not found')
    const info = await this.sendAndArchive({
      from: this.fromAddress,
      to: original.email,
      subject: original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`,
      text: input.body,
    })
    return { id: info.messageId, status: 'sent' }
  }

  async replyAll(id: string, input: { body: string }) {
    const original = await this.getMessage(id)
    if (!original) throw new Error('Message not found')
    const recipients = computeReplyAllRecipients({
      mailboxEmail: this.credentials.email,
      senderEmail: original.email,
      to: original.to,
      cc: original.cc,
    })
    const info = await this.sendAndArchive({
      from: this.fromAddress,
      to: recipients.to,
      cc: recipients.cc.length ? recipients.cc : undefined,
      subject: original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`,
      text: input.body,
    })
    return { id: info.messageId, status: 'sent' }
  }

  async forward(id: string, input: { to: string; cc?: string; bcc?: string; body: string }) {
    const original = await this.getMessage(id)
    if (!original) throw new Error('Message not found')
    const info = await this.sendAndArchive({
      from: this.fromAddress,
      to: input.to,
      cc: input.cc?.trim() || undefined,
      bcc: input.bcc?.trim() || undefined,
      subject: original.subject.startsWith('Fwd:') ? original.subject : `Fwd: ${original.subject}`,
      text: `${input.body}\n\n---- Forwarded message ----\n${original.body.join('\n')}`,
    })
    return { id: info.messageId, status: 'sent' }
  }

  async markRead(id: string) {
    const { mailbox, uid } = decodeMessageId(id)
    const client = this.createImapClient()
    await client.connect()
    try {
      await client.mailboxOpen(mailbox)
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
      return { id, unread: false }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async toggleStar(id: string) {
    const { mailbox, uid } = decodeMessageId(id)
    const client = this.createImapClient()
    await client.connect()
    try {
      await client.mailboxOpen(mailbox)
      const message = await client.fetchOne(uid, { flags: true }, { uid: true })
      const starred = !message?.flags?.has('\\Flagged')
      if (starred) await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true })
      else await client.messageFlagsRemove(uid, ['\\Flagged'], { uid: true })
      return { id, starred }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async move(id: string, folder: string) {
    const { mailbox, uid } = decodeMessageId(id)
    const client = this.createImapClient()
    await client.connect()
    try {
      const mailboxes = await client.list()
      const target = mailboxes.find((entry: { path: string; specialUse?: string }) => folderLabel(entry).toLowerCase() === folder.toLowerCase() || entry.path.toLowerCase() === folder.toLowerCase())
      const targetMailbox = target?.path ?? folder
      if (!target) await client.mailboxCreate(targetMailbox)
      await client.mailboxOpen(mailbox)
      await client.messageMove(uid, targetMailbox, { uid: true })
      return { id, folder }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async delete(id: string) {
    await this.move(id, 'Trash')
    return { id, deleted: true as const }
  }

  async listLabels(folder: string): Promise<string[]> {
    const labels = new Set<string>()
    for (const message of await this.listMessages(folder)) {
      for (const label of message.labels ?? []) labels.add(label)
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b))
  }

  async setMessageLabels(id: string, labels: string[]) {
    const { mailbox, uid } = decodeMessageId(id)
    const unique = Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean)))
    const client = this.createImapClient()
    await client.connect()
    try {
      await client.mailboxOpen(mailbox)
      const message = await client.fetchOne(uid, { flags: true }, { uid: true })
      const currentLabelFlags = new Set(
        Array.from(message?.flags ?? []).filter(
          (flag): flag is string => typeof flag === 'string' && flag.startsWith(LABEL_FLAG_PREFIX),
        ),
      )
      const nextFlags = new Set(unique.map(encodeLabelFlag))

      const toRemove = Array.from(currentLabelFlags).filter((flag) => !nextFlags.has(flag))
      const toAdd = Array.from(nextFlags).filter((flag) => !currentLabelFlags.has(flag))

      if (toRemove.length) await client.messageFlagsRemove(uid, toRemove, { uid: true })
      if (toAdd.length) await client.messageFlagsAdd(uid, toAdd, { uid: true })

      return { id, labels: unique }
    } finally {
      await client.logout().catch(() => {})
    }
  }
}
