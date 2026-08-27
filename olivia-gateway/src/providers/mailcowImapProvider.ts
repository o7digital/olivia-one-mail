import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import { folders as mockFolders } from '../data/mockData.js'
import { getMailcowConnectionConfig, type MailboxCredentials, type MailcowConnectionConfig } from '../services/mailcowAuth.js'
import { computeReplyAllRecipients } from '../services/mailRecipients.js'
import type { Folder, MailAttachment, MailMessage } from '../types/domain.js'
import type { MailProvider } from './mailProvider.js'

function mapFolderLabel(folder: string) {
  const lower = folder.toLowerCase()
  if (lower === 'inbox') return 'INBOX'
  if (lower === 'sent') return 'Sent'
  if (lower === 'drafts') return 'Drafts'
  if (lower === 'trash') return 'Trash'
  if (lower === 'archive') return 'Archive'
  if (lower === 'spam') return 'Junk'
  return folder
}

function decodeText(value: unknown) {
  if (typeof value === 'string') return value
  return ''
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
      auth: {
        user: this.credentials.email,
        pass: this.credentials.password,
      },
    })
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

      return mockFolders.map((folder) => ({
        label: folder.label,
        count: counts.get(mapFolderLabel(folder.label)) ?? folder.count,
      }))
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async listMessages(folder: string): Promise<MailMessage[]> {
    const client = this.createImapClient()
    await client.connect()
    try {
      const mailbox = mapFolderLabel(folder)
      await client.mailboxOpen(mailbox)
      const total = client.mailbox.exists || 0
      if (!total) return []

      const start = Math.max(total - 24, 1)
      const rows: MailMessage[] = []

      for await (const message of client.fetch(`${start}:${total}`, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        source: { maxLength: 1024 * 1024 * 3 },
      })) {
        const parsed = message.source ? await simpleParser(message.source) : null
        const from = message.envelope?.from?.[0]
        const name = from?.name || from?.address || this.credentials.email
        const email = from?.address || this.credentials.email
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
          id: String(message.uid),
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
          attachments,
          to: mapAddressList(message.envelope?.to),
          cc: mapAddressList(message.envelope?.cc),
          labels: decodeLabelsFromFlags(message.flags),
        })
      }

      return rows.reverse()
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async getMessage(id: string): Promise<MailMessage | null> {
    const foldersToSearch = ['Inbox', 'Priority', 'Sent', 'Drafts', 'Archive', 'Trash', 'Spam']
    for (const folder of foldersToSearch) {
      const messages = await this.listMessages(folder)
      const found = messages.find((message) => message.id === id)
      if (found) return found
    }
    return null
  }

  async sendMessage(input: { to: string; subject: string; body: string }) {
    const transport = this.createTransport()
    const info = await transport.sendMail({
      from: `"${this.config.fromName}" <${this.credentials.email}>`,
      to: input.to,
      subject: input.subject,
      text: input.body,
    })
    return { id: info.messageId, status: 'sent' }
  }

  async reply(id: string, input: { body: string }) {
    const original = await this.getMessage(id)
    if (!original) throw new Error('Message not found')
    const transport = this.createTransport()
    const info = await transport.sendMail({
      from: `"${this.config.fromName}" <${this.credentials.email}>`,
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
    const transport = this.createTransport()
    const info = await transport.sendMail({
      from: `"${this.config.fromName}" <${this.credentials.email}>`,
      to: recipients.to,
      cc: recipients.cc.length ? recipients.cc : undefined,
      subject: original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`,
      text: input.body,
    })
    return { id: info.messageId, status: 'sent' }
  }

  async forward(id: string, input: { to: string; body: string }) {
    const original = await this.getMessage(id)
    if (!original) throw new Error('Message not found')
    const transport = this.createTransport()
    const info = await transport.sendMail({
      from: `"${this.config.fromName}" <${this.credentials.email}>`,
      to: input.to,
      subject: original.subject.startsWith('Fwd:') ? original.subject : `Fwd: ${original.subject}`,
      text: `${input.body}\n\n---- Forwarded message ----\n${original.body.join('\n')}`,
    })
    return { id: info.messageId, status: 'sent' }
  }

  async markRead(id: string) {
    const client = this.createImapClient()
    await client.connect()
    try {
      await client.mailboxOpen('INBOX')
      await client.messageFlagsAdd(id, ['\\Seen'], { uid: true })
      return { id, unread: false }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async toggleStar(id: string) {
    const client = this.createImapClient()
    await client.connect()
    try {
      await client.mailboxOpen('INBOX')
      const message = await client.fetchOne(id, { flags: true }, { uid: true })
      const starred = !message?.flags?.has('\\Flagged')
      if (starred) await client.messageFlagsAdd(id, ['\\Flagged'], { uid: true })
      else await client.messageFlagsRemove(id, ['\\Flagged'], { uid: true })
      return { id, starred }
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async move(id: string, folder: string) {
    const client = this.createImapClient()
    await client.connect()
    try {
      await client.mailboxOpen('INBOX')
      await client.messageMove(id, mapFolderLabel(folder), { uid: true })
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
    const client = this.createImapClient()
    await client.connect()
    try {
      await client.mailboxOpen(mapFolderLabel(folder))
      return decodeLabelsFromFlags(client.mailbox ? client.mailbox.flags : undefined)
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async setMessageLabels(id: string, labels: string[]) {
    const unique = Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean)))
    const client = this.createImapClient()
    await client.connect()
    try {
      await client.mailboxOpen('INBOX')
      const message = await client.fetchOne(id, { flags: true }, { uid: true })
      const currentLabelFlags = new Set(
        Array.from(message?.flags ?? []).filter(
          (flag): flag is string => typeof flag === 'string' && flag.startsWith(LABEL_FLAG_PREFIX),
        ),
      )
      const nextFlags = new Set(unique.map(encodeLabelFlag))

      const toRemove = Array.from(currentLabelFlags).filter((flag) => !nextFlags.has(flag))
      const toAdd = Array.from(nextFlags).filter((flag) => !currentLabelFlags.has(flag))

      if (toRemove.length) await client.messageFlagsRemove(id, toRemove, { uid: true })
      if (toAdd.length) await client.messageFlagsAdd(id, toAdd, { uid: true })

      return { id, labels: unique }
    } finally {
      await client.logout().catch(() => {})
    }
  }
}
