import test from 'node:test'
import assert from 'node:assert/strict'
import { computeReplyAllRecipients } from './mailRecipients.js'

test('reply-all includes original sender and To/CC, excluding the authenticated mailbox', () => {
  const result = computeReplyAllRecipients({
    mailboxEmail: 'olivier@o7digitalgroup.com',
    senderEmail: 'Sophia@AcmeCorp.com',
    to: ['olivier@o7digitalgroup.com', 'teammate@acmecorp.com'],
    cc: ['legal@acmecorp.com', 'olivier@o7digitalgroup.com'],
  })

  assert.deepEqual(result.to, ['Sophia@AcmeCorp.com', 'teammate@acmecorp.com'])
  assert.deepEqual(result.cc, ['legal@acmecorp.com'])
})

test('reply-all does not duplicate the sender if it also appears in To/CC', () => {
  const result = computeReplyAllRecipients({
    mailboxEmail: 'olivier@o7digitalgroup.com',
    senderEmail: 'sophia@acmecorp.com',
    to: ['sophia@acmecorp.com'],
    cc: ['sophia@acmecorp.com'],
  })

  assert.deepEqual(result.to, ['sophia@acmecorp.com'])
  assert.deepEqual(result.cc, [])
})

test('reply-all with no To/CC still replies to the sender only', () => {
  const result = computeReplyAllRecipients({
    mailboxEmail: 'olivier@o7digitalgroup.com',
    senderEmail: 'liam@northstar.io',
  })

  assert.deepEqual(result.to, ['liam@northstar.io'])
  assert.deepEqual(result.cc, [])
})
