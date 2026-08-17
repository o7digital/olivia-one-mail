import { ImapFlow } from 'imapflow'

export interface MailboxCredentials {
  email: string
  password: string
}

export interface MailcowConnectionConfig {
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  fromName: string
}

function requireConfig(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getMailcowConnectionConfig(): MailcowConnectionConfig {
  return {
    imapHost: requireConfig('MAIL_IMAP_HOST', process.env.MAIL_IMAP_HOST),
    imapPort: Number(process.env.MAIL_IMAP_PORT ?? 993),
    imapSecure: process.env.MAIL_IMAP_SECURE !== 'false',
    smtpHost: requireConfig('MAIL_SMTP_HOST', process.env.MAIL_SMTP_HOST),
    smtpPort: Number(process.env.MAIL_SMTP_PORT ?? 587),
    smtpSecure: process.env.MAIL_SMTP_SECURE === 'true',
    fromName: process.env.MAIL_FROM_NAME ?? 'Olivia One',
  }
}

export async function authenticateMailbox(
  credentials: MailboxCredentials,
  config = getMailcowConnectionConfig(),
) {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: {
      user: credentials.email,
      pass: credentials.password,
    },
  })

  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    return true
  } finally {
    await client.logout().catch(() => {})
  }
}
