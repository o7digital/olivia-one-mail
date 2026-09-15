import assert from 'node:assert/strict'
import test from 'node:test'
import nodemailer from 'nodemailer'
import { buildForwardedHtml, buildForwardedText, MailcowImapProvider } from './mailcowImapProvider.js'

const originalMessage = {
  id: 'message-1', folder: 'Inbox', sender: 'Qonto Support', initials: 'QS', time: '5:16 PM', receivedAt: '2026-09-14T22:16:00.000Z',
  tone: 'cyan', email: 'support@qonto.com', role: '', company: 'qonto.com', subject: 'Payment notice', preview: 'Payment details',
  bodyText: 'Amount: 408,89 EUR\n\nAccount: O7 Digital', body: ['Amount: 408,89 EUR', 'Account: O7 Digital'], bodyHtml: '<p><strong>Amount:</strong> 408,89 EUR</p><p>Account: O7 Digital</p>',
  attachments: [], to: ['info@o7digitalgroup.com'], cc: ['accounts@o7digitalgroup.com'],
} as const

test('forwarded content retains original headers and body without a note', () => {
  const text = buildForwardedText(originalMessage, '')
  const html = buildForwardedHtml(originalMessage, '', '')

  for (const expected of ['From: Qonto Support <support@qonto.com>', 'Date: Mon, 14 Sep 2026 22:16:00 GMT', 'Subject: Payment notice', 'To: info@o7digitalgroup.com', 'Cc: accounts@o7digitalgroup.com', 'Amount: 408,89 EUR', 'Account: O7 Digital']) {
    assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  for (const expected of ['From: Qonto Support &lt;support@qonto.com&gt;', 'Date: Mon, 14 Sep 2026 22:16:00 GMT', 'Subject: Payment notice', 'To: info@o7digitalgroup.com', 'Cc: accounts@o7digitalgroup.com', '<strong>Amount:</strong> 408,89 EUR', 'Account: O7 Digital']) {
    assert.ok(html.includes(expected))
  }
})

test('forwarded HTML retains a plain-text note and escapes untrusted original fields', () => {
  const unsafeMessage = { ...originalMessage, bodyHtml: undefined, sender: '<Qonto>', bodyText: '<script>alert(1)</script>', body: ['<script>alert(1)</script>'] }
  const html = buildForwardedHtml(unsafeMessage, '', 'See below & confirm')

  assert.match(html, /See below &amp; confirm/)
  assert.match(html, /From: &lt;Qonto&gt; &lt;support@qonto.com&gt;/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test('forward sends the editor history and carries original MIME attachments', async () => {
  const provider = new MailcowImapProvider(
    { email: 'sender@example.com', password: 'secret' },
    { imapHost: 'imap', imapPort: 993, imapSecure: true, smtpHost: 'smtp', smtpPort: 587, smtpSecure: false, fromName: 'Sender', fromNameMap: {} },
  )
  const originalAttachment = { filename: 'invoice.pdf', contentType: 'application/pdf', content: Buffer.from('pdf'), cid: undefined }
  let captured: Record<string, unknown> | undefined
  ;(provider as unknown as { getMessage: () => Promise<typeof originalMessage> }).getMessage = async () => originalMessage
  ;(provider as unknown as { getOriginalAttachments: () => Promise<typeof originalAttachment[]> }).getOriginalAttachments = async () => [originalAttachment]
  ;(provider as unknown as { sendAndArchive: (message: Record<string, unknown>) => Promise<{ messageId: string }> }).sendAndArchive = async (message) => {
    captured = message
    return { messageId: 'forwarded-message-id' }
  }

  const result = await provider.forward('message-1', {
    to: 'recipient@example.com',
    body: 'My note\n\n---------- Forwarded message ---------\nFrom: Qonto Support <support@qonto.com>\n\nAmount: 408,89 EUR',
    html: '<p>My note</p><section data-forwarded-content="true">Forwarded message</section>',
    forwardedContentIncluded: true,
  })

  assert.equal(result.id, 'forwarded-message-id')
  assert.equal(captured?.subject, 'Fwd: Payment notice')
  assert.match(String(captured?.text), /Qonto Support/)
  assert.match(String(captured?.html), /data-forwarded-content/)
  assert.equal((captured?.attachments as Array<{ filename: string }>)[0].filename, 'invoice.pdf')
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
