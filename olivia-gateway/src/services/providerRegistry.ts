import { MailcowImapProvider } from '../providers/mailcowImapProvider.js'
import { MockMailProvider } from '../providers/mockMailProvider.js'
import type { MailProvider } from '../providers/mailProvider.js'

export function createMailProvider(provider = process.env.MAIL_PROVIDER): MailProvider {
  switch (provider) {
    case undefined:
    case 'mock':
      return new MockMailProvider()
    case 'mailcow-imap':
      return new MailcowImapProvider()
    default:
      throw new Error(`Unsupported mail provider: ${provider}`)
  }
}
