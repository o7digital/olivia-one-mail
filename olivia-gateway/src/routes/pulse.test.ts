import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerPulseRoutes } from './pulse.js'

async function buildApp(env: { pulseCrmApiUrl: string; pulseCrmIntegrationSecret: string }, mailboxEmail = 'olivier@o7digitalgroup.com') {
  const app = Fastify()
  app.decorate('env', env)
  app.addHook('onRequest', async (request) => {
    request.session = { id: 's1', email: mailboxEmail, password: 'do-not-use', createdAt: 0, expiresAt: Date.now() + 1000 }
  })
  await registerPulseRoutes(app)
  return app
}

test('pulse opportunities route calls the real CRM API and returns real CRM ids, not synthetic ones', async () => {
  const calls: Array<{ url: string; headers: Headers; payload: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      payload: JSON.parse(String(init?.body ?? '{}')),
    })
    return new Response(JSON.stringify({ clientId: 'client-real-1', dealId: 'deal-real-1', taskIds: ['task-real-1'] }), { status: 200 })
  }) as typeof fetch

  try {
    const app = await buildApp({ pulseCrmApiUrl: 'https://crm-api.internal', pulseCrmIntegrationSecret: 'top-secret' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/pulse/opportunities',
      payload: {
        title: 'Partnership expansion',
        messageId: 'msg-42',
        senderName: 'Sophia Martinez',
        senderEmail: 'sophia@acmecorp.com',
        company: 'Acme Corp',
        estimatedValue: 5000,
        currency: 'USD',
        confidence: 0.8,
        tasks: [{ title: 'Send proposal', dueAt: null }],
      },
    })

    assert.equal(response.statusCode, 200)
    const body = response.json()
    assert.equal(body.clientId, 'client-real-1')
    assert.equal(body.dealId, 'deal-real-1')
    assert.deepEqual(body.taskIds, ['task-real-1'])
    assert.equal(JSON.stringify(body).includes('pulse-opp:'), false)
    assert.equal(JSON.stringify(body).includes('top-secret'), false)

    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /\/integrations\/olivia\/opportunities$/)
    assert.equal(calls[0].headers.get('x-o7-integration-secret'), 'top-secret')
    assert.equal(calls[0].payload.sourceMailbox, 'olivier@o7digitalgroup.com')
    assert.equal(calls[0].payload.sourceDomain, 'o7digitalgroup.com')
    assert.equal(calls[0].payload.sourceMessageId, 'msg-42')
    await app.close()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('pulse opportunities route returns 503 without a fake fallback when the CRM call fails', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('{}', { status: 500 })) as typeof fetch

  try {
    const app = await buildApp({ pulseCrmApiUrl: 'https://crm-api.internal', pulseCrmIntegrationSecret: 'top-secret' })
    const response = await app.inject({
      method: 'POST',
      url: '/api/pulse/opportunities',
      payload: {
        title: 'Partnership expansion',
        messageId: 'msg-42',
        senderName: 'Sophia Martinez',
        senderEmail: 'sophia@acmecorp.com',
        tasks: [],
      },
    })

    assert.equal(response.statusCode, 503)
    assert.match(response.body, /temporarily unavailable/)
    await app.close()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('pulse opportunities route returns 503 when PULSE_CRM_API_URL is not configured', async () => {
  const app = await buildApp({ pulseCrmApiUrl: '', pulseCrmIntegrationSecret: '' })
  const response = await app.inject({
    method: 'POST',
    url: '/api/pulse/opportunities',
    payload: {
      title: 'Partnership expansion',
      messageId: 'msg-42',
      senderName: 'Sophia Martinez',
      senderEmail: 'sophia@acmecorp.com',
      tasks: [],
    },
  })

  assert.equal(response.statusCode, 503)
  await app.close()
})
