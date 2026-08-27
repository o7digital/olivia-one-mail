import test from 'node:test'
import assert from 'node:assert/strict'
import { __resetSessionsForTests, __setSessionClockForTests, createServerSession, deleteServerSession, getServerSession } from './session.js'

test('server sessions expire after 8 hours', () => {
  __resetSessionsForTests()
  __setSessionClockForTests(() => 1_000)

  const session = createServerSession({ email: 'info@o7digitalgroup.com', password: 'secret-pass' })
  assert.equal(getServerSession(session.id)?.email, 'info@o7digitalgroup.com')

  __setSessionClockForTests(() => 1_000 + 8 * 60 * 60 * 1000 + 1)
  assert.equal(getServerSession(session.id), null)
})

test('deleteServerSession removes session state', () => {
  __resetSessionsForTests()
  const session = createServerSession({ email: 'ops@o7digitalgroup.com', password: 'secret-pass' })
  deleteServerSession(session.id)
  assert.equal(getServerSession(session.id), null)
})

test('server session records privacy notice acceptance metadata', () => {
  __resetSessionsForTests()
  __setSessionClockForTests(() => 42_000)
  const session = createServerSession({ email: 'privacy@o7digitalgroup.com', password: 'secret-pass', privacyVersion: '2026-08-27' })

  assert.equal(session.privacyVersion, '2026-08-27')
  assert.equal(session.privacyAcceptedAt, 42_000)
})
