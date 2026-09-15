import assert from 'node:assert/strict'
import test from 'node:test'
import nodemailer from 'nodemailer'
import { buildForwardedHtml, buildForwardedText, MailcowImapProvider } from './mailcowImapProvider.js'

const originalMessage = {
  id: 'message-1', folder: 'Inbox', sender: 'Qonto Support', initials: 'QS', time: '5:16 PM', receivedAt: '2026-09-14T22:16:00.000Z',
  tone: 'cyan', email: 'support@qonto.com', role: '', company: 'qonto.com', subject: 'Payment notice', preview: 'Payment details',
  body: ['Amount: 408,89 EUR', 'Account: O7 Digital'], attachments: [], to: ['info@o7digitalgroup.com'], cc: ['accounts@o7digitalgroup.com'],
} as const

test('forwarded content retains original headers and body without a note', () => {
  const text = buildForwardedText(originalMessage, '')
  const html = buildForwardedHtml(originalMessage, '', '')

  for (const expected of ['From: Qonto Support <support@qonto.com>', 'Date: Mon, 14 Sep 2026 22:16:00 GMT', 'Subject: Payment notice', 'To: info@o7digitalgroup.com', 'Cc: accounts@o7digitalgroup.com', 'Amount: 408,89 EUR', 'Account: O7 Digital']) {
    assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  for (const expected of ['From: Qonto Support &lt;support@qonto.com&gt;', 'Date: Mon, 14 Sep 2026 22:16:00 GMT', 'Subject: Payment notice', 'To: info@o7digitalgroup.com', 'Cc: accounts@o7digitalgroup.com', 'Amount: 408,89 EUR', 'Account: O7 Digital']) {
    assert.ok(html.includes(expected))
  }
})

test('forwarded HTML retains a plain-text note and escapes untrusted original fields', () => {
  const unsafeMessage = { ...originalMessage, sender: '<Qonto>', body: ['<script>alert(1)</script>'] }
  const html = buildForwardedHtml(unsafeMessage, '', 'See below & confirm')

  assert.match(html, /See below &amp; confirm/)
  assert.match(html, /From: &lt;Qonto&gt; &lt;support@qonto.com&gt;/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

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
