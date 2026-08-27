import test from 'node:test'
import assert from 'node:assert/strict'
import cookie from '@fastify/cookie'
import Fastify from 'fastify'
import { registerAuthRoutes } from './auth.js'
import { type MailboxCredentials } from '../services/mailcowAuth.js'
import { __resetSessionsForTests, __setSessionClockForTests, getSignedSessionId, requireSession } from '../services/session.js'

async function buildApp(authenticateMailbox: (credentials: MailboxCredentials) => Promise<boolean>) {
  const app = Fastify()
  app.decorate('env', { appOrigin: 'http://localhost:5173' })
  app.decorate('authenticateMailbox', authenticateMailbox)
  app.decorate('requireSession', requireSession())
  await app.register(cookie, { secret: 'test-secret' })
  await registerAuthRoutes(app)
  app.get('/protected', { preHandler: app.requireSession }, async (request) => ({
    email: request.session!.email,
    sessionId: getSignedSessionId(request),
  }))
  return app
}

test('login returns 401 for invalid mailbox or password', async () => {
  __resetSessionsForTests()
  const app = await buildApp(async () => {
    throw new Error('invalid')
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'bad@o7digitalgroup.com', password: 'wrong-pass', privacyAccepted: true, privacyVersion: '2026-08-27' },
  })

  assert.equal(response.statusCode, 401)
  assert.match(response.body, /Invalid credentials/)
  await app.close()
})

test('login sets opaque cookie and logout destroys the server session', async () => {
  __resetSessionsForTests()
  __setSessionClockForTests(() => 10_000)
  const app = await buildApp(async () => true)

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'info@o7digitalgroup.com', password: 'valid-pass', privacyAccepted: true, privacyVersion: '2026-08-27' },
  })

  assert.equal(login.statusCode, 200)
  const body = login.json()
  assert.equal(body.user.email, 'info@o7digitalgroup.com')
  assert.deepEqual(body.privacy, { accepted: true, version: '2026-08-27' })
  assert.equal(JSON.stringify(body).includes('valid-pass'), false)

  const setCookies = login.cookies
  const sessionCookie = setCookies.find((entry) => entry.name === 'olivia_session')
  assert.ok(sessionCookie)
  assert.equal(sessionCookie?.value.includes('info@o7digitalgroup.com'), false)
  assert.equal(sessionCookie?.value.includes('valid-pass'), false)

  const protectedResponse = await app.inject({
    method: 'GET',
    url: '/protected',
    cookies: Object.fromEntries(setCookies.map((entry) => [entry.name, entry.value])),
  })

  assert.equal(protectedResponse.statusCode, 200)
  assert.equal(protectedResponse.json().email, 'info@o7digitalgroup.com')

  const logout = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    cookies: Object.fromEntries(setCookies.map((entry) => [entry.name, entry.value])),
  })

  assert.equal(logout.statusCode, 200)

  const afterLogout = await app.inject({
    method: 'GET',
    url: '/protected',
    cookies: Object.fromEntries(setCookies.map((entry) => [entry.name, entry.value])),
  })

  assert.equal(afterLogout.statusCode, 401)
  await app.close()
})

test('session expires after 8 hours for authenticated routes', async () => {
  __resetSessionsForTests()
  __setSessionClockForTests(() => 5_000)
  const app = await buildApp(async () => true)

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'ops@o7digitalgroup.com', password: 'valid-pass', privacyAccepted: true, privacyVersion: '2026-08-27' },
  })

  const cookies = Object.fromEntries(login.cookies.map((entry) => [entry.name, entry.value]))
  __setSessionClockForTests(() => 5_000 + 8 * 60 * 60 * 1000 + 1)

  const expired = await app.inject({
    method: 'GET',
    url: '/protected',
    cookies,
  })

  assert.equal(expired.statusCode, 401)
  await app.close()
})
