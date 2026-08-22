import { MailcowImapProvider } from '../providers/mailcowImapProvider.js'
import { MockMailProvider } from '../providers/mockMailProvider.js'
import type { MailProvider } from '../providers/mailProvider.js'
import { authenticateMailbox, type MailboxCredentials } from './mailcowAuth.js'
import type { SessionRecord } from './session.js'

export function createMailboxAuthenticator(provider = process.env.MAIL_PROVIDER) {
  switch (provider) {
    case undefined:
    case 'mock':
      return async (_credentials: MailboxCredentials) => true
    case 'mailcow-imap':
      return authenticateMailbox
    default:
      throw new Error(`Unsupported mail provider: ${provider}`)
  }
}

export function createMailProvider(provider = process.env.MAIL_PROVIDER, session?: SessionRecord): MailProvider {
  switch (provider) {
    case undefined:
    case 'mock':
      return new MockMailProvider()
    case 'mailcow-imap':
      if (!session) throw new Error('Authenticated session required for Mailcow provider')
      return new MailcowImapProvider({
        email: session.email,
        password: session.password,
      })
    default:
      throw new Error(`Unsupported mail provider: ${provider}`)
  }
}
