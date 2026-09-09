import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { getEnv } from '../config/env.js'
import { registerProtectedRoutes } from './protected.js'

async function appFor(email: string) {
  const app = Fastify()
  app.decorate('env', { ...getEnv(), aiMailboxClientMap: { 'test@example.com': 'sandbox' }, aiDomainClientMap: { 'example.com': 'live' }, aiV3TestMailbox: 'test@example.com', aiV3TestTenant: 'sandbox', aiV3ApiUrl: 'https://v3.invalid', aiV3Token: 'private-token', aiV3PollMs: 1 })
  await registerProtectedRoutes(app, async request => {
    request.session = { id: 'id', email, password: 'private-mailbox-password', createdAt: 0, expiresAt: Date.now() + 10000 }
  })
  return app
}

test('V3 mailbox permits only user-triggered mail mutations through normal routes', async () => {
  const app = await appFor('test@example.com')
  try {
    for (const [method, url, payload] of [
      ['POST', '/api/mail/send', { to: 'real@example.com', subject: 'No send', body: 'No send' }],
      ['POST', '/api/mail/messages/partnership-proposal/read', {}],
    ] as const) {
      const response = await app.inject({ method, url, payload })
      assert.equal(response.statusCode, 200)
    }
  } finally { await app.close() }
})

test('AI routes reject unmapped authenticated mailbox and ignore browser routing overrides', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, init) => {
    calls++
    assert.equal(new Headers(init?.headers).get('x-tenant-id'), 'sandbox')
    return Response.json(init?.method === 'POST'
      ? { job_id: 'job', status: 'queued', sandbox: true }
      : { job_id: 'job', status: 'succeeded', sandbox: true, result: { text: 'Safe draft', tone: 'formal', language: 'auto' } })
  }
  const unmapped = await appFor('missing@unknown.com')
  const sandbox = await appFor('test@example.com')
  try {
    const denied = await unmapped.inject({ method: 'POST', url: '/api/ai/rewrite', payload: { draft: 'hello', action: 'formal' } })
    assert.equal(denied.statusCode, 403)
    assert.equal(denied.json().code, 'TENANT_UNMAPPED')
    assert.equal(calls, 0)
    const accepted = await sandbox.inject({ method: 'POST', url: '/api/ai/rewrite', payload: { draft: 'hello', action: 'formal', engine: 'v2', mailboxEmail: 'live@example.com', tenant: 'live', aiV3ApiUrl: 'https://attacker.invalid' } })
    assert.equal(accepted.statusCode, 200)
    assert.equal(accepted.json().draft, 'Safe draft')
    assert.equal(accepted.body.includes('private'), false)
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original; await unmapped.close(); await sandbox.close() }
})
