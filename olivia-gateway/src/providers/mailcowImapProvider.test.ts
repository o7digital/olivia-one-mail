import assert from 'node:assert/strict'
import test from 'node:test'
import nodemailer from 'nodemailer'
import { MailcowImapProvider } from './mailcowImapProvider.js'

test('successful SMTP delivery does not wait for the Sent-folder IMAP copy', async () => {
  const originalCreateTransport = nodemailer.createTransport
  let transportCall = 0
  nodemailer.createTransport = (() => {
    transportCall += 1
    if (transportCall === 1) {
      return { sendMail: async () => ({ message: Buffer.from('compiled message'), envelope: { from: 'sender@example.com', to: ['client@example.com'] } }) }
    }
    return { sendMail: async () => ({ messageId: 'sent-message-id' }) }
  }) as typeof nodemailer.createTransport

  try {
    const provider = new MailcowImapProvider(
      { email: 'sender@example.com', password: 'secret' },
      { imapHost: 'imap', imapPort: 993, imapSecure: true, smtpHost: 'smtp', smtpPort: 587, smtpSecure: false, fromName: 'Sender', fromNameMap: {} },
    )
    ;(provider as unknown as { appendToSent: () => Promise<void> }).appendToSent = () => new Promise(() => {})

    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('send waited for IMAP archive')), 200))
    const result = await Promise.race([
      provider.sendMessage({ to: 'client@example.com', subject: 'Test', body: 'Hello' }),
      timeout,
    ])
    assert.equal(result.id, 'sent-message-id')
  } finally {
    nodemailer.createTransport = originalCreateTransport
  }
})
