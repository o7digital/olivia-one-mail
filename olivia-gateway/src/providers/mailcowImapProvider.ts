import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import { folders as mockFolders } from '../data/mockData.js'
import type { Folder, MailMessage } from '../types/domain.js'
import type { MailProvider } from './mailProvider.js'

interface MailcowConfig {
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  authUser: string
  authPass: string
  fromName: string
}

function requireConfig(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function buildConfig(): MailcowConfig {
  return {
    imapHost: requireConfig('MAIL_IMAP_HOST', process.env.MAIL_IMAP_HOST),
    imapPort: Number(process.env.MAIL_IMAP_PORT ?? 993),
    imapSecure: process.env.MAIL_IMAP_SECURE !== 'false',
    smtpHost: requireConfig('MAIL_SMTP_HOST', process.env.MAIL_SMTP_HOST),
    smtpPort: Number(process.env.MAIL_SMTP_PORT ?? 587),
    smtpSecure: process.env.MAIL_SMTP_SECURE === 'true',
    authUser: requireConfig('MAIL_AUTH_USER', process.env.MAIL_AUTH_USER),
    authPass: requireConfig('MAIL_AUTH_PASS', process.env.MAIL_AUTH_PASS),
    fromName: process.env.MAIL_FROM_NAME ?? 'Olivia One',
  }
}

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

export class MailcowImapProvider implements MailProvider {
  private config = buildConfig()

  private createImapClient() {
    return new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapSecure,
      auth: {
        user: this.config.authUser,
        pass: this.config.authPass,
      },
    })
  }

  private createTransport() {
    return nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: {
        user: this.config.authUser,
        pass: this.config.authPass,
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
        bodyStructure: true,
        internalDate: true,
        source: { maxLength: 20480 },
      })) {
        const parsed = message.source ? await simpleParser(message.source) : null
        const from = message.envelope?.from?.[0]
        const name = from?.name || from?.address || this.config.authUser
        const email = from?.address || this.config.authUser
        const date = message.internalDate ?? new Date()
        const bodyText = decodeText(parsed?.text).trim()
        const preview = bodyText.split('\n').find(Boolean)?.slice(0, 120) ?? 'No preview available.'

        rows.push({
          id: String(message.uid),
          folder,
          sender: name,
          initials: name.split(/\s+/).slice(0, 2).map((part: string) => part[0] ?? '').join('').toUpperCase() || 'OO',
          time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          unread: !message.flags?.has('\\Seen'),
          starred: Boolean(message.flags?.has('\\Flagged')),
          tone: 'cyan',
          email,
          role: '',
          company: email.split('@')[1] ?? '',
          subject: message.envelope?.subject || '(No subject)',
          preview,
          body: bodyText ? bodyText.split('\n').filter(Boolean).slice(0, 8) : ['No body preview available.'],
          attachments: [],
        })
      }

      return rows.reverse()
    } finally {
      await client.logout().catch(() => {})
    }
  }

  async getMessage(id: string): Promise<MailMessage | null> {
    const messages = await this.listMessages('Inbox')
    return messages.find((message) => message.id === id) ?? null
  }

  async sendMessage(input: { to: string; subject: string; body: string }) {
    const transport = this.createTransport()
    const info = await transport.sendMail({
      from: `"${this.config.fromName}" <${this.config.authUser}>`,
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
      from: `"${this.config.fromName}" <${this.config.authUser}>`,
      to: original.email,
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
      from: `"${this.config.fromName}" <${this.config.authUser}>`,
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
      if (starred) {
        await client.messageFlagsAdd(id, ['\\Flagged'], { uid: true })
      } else {
        await client.messageFlagsRemove(id, ['\\Flagged'], { uid: true })
      }
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
}
