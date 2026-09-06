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
  fromNameMap: Record<string, string>
}

function requireConfig(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function parseFromNameMap(value: string | undefined): Record<string, string> {
  if (!value) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('MAIL_FROM_NAME_MAP must be valid JSON')
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('MAIL_FROM_NAME_MAP must be a JSON object')
  }

  return Object.fromEntries(Object.entries(parsed).map(([email, name]) => {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error(`MAIL_FROM_NAME_MAP has an invalid name for ${email}`)
    }
    return [email.trim().toLowerCase(), name.trim()]
  }))
}

export function resolveFromName(email: string, config: Pick<MailcowConnectionConfig, 'fromName' | 'fromNameMap'>) {
  const normalizedEmail = email.trim().toLowerCase()
  const mappedName = config.fromNameMap[normalizedEmail]
  if (mappedName) return mappedName

  // Each authenticated session belongs to one mailbox. Prefer its local part
  // over a global operator name when no explicit client mapping exists.
  const localPart = normalizedEmail.split('@')[0] ?? ''
  const mailboxName = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')

  return mailboxName || config.fromName
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
    fromNameMap: parseFromNameMap(process.env.MAIL_FROM_NAME_MAP),
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
