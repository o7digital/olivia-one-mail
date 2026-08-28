import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerAIRoutes } from './ai.js'

test('AI route returns a generic 503 without exposing credentials or browser clientCode', async () => {
  const app = Fastify()
  const originalFetch = globalThis.fetch
  let upstreamPayload: Record<string, unknown> = {}
  globalThis.fetch = async (_input, init) => {
    upstreamPayload = JSON.parse(String(init?.body ?? '{}'))
    return new Response(JSON.stringify({ detail: 'Invalid internal token' }), { status: 401 })
  }

  app.decorate('env', {
    aiApiUrl: 'https://olivia-v2-python-dev-production.up.railway.app',
    oliviaInternalToken: 'server-only-token',
    aiMailboxClientMap: {},
    aiDomainClientMap: { 'brand.com': 'brand-tenant' },
    aiDefaultClientCode: 'default',
  })
  app.addHook('preHandler', async (request) => {
    request.session = {
      id: 'session-id',
      email: 'user@brand.com',
      password: 'mailbox-password',
      createdAt: 0,
      expiresAt: Number.MAX_SAFE_INTEGER,
    }
  })
  await registerAIRoutes(app)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/rewrite',
      payload: {
        action: 'formal',
        draft: 'Hello',
        clientCode: 'other-tenant',
      },
    })

    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { message: 'Olivia AI temporarily unavailable' })
    assert.equal(upstreamPayload.clientCode, 'brand-tenant')
    assert.equal(JSON.stringify(upstreamPayload).includes('mailbox-password'), false)
    assert.equal(response.body.includes('server-only-token'), false)
    assert.equal(response.body.includes('other-tenant'), false)
  } finally {
    globalThis.fetch = originalFetch
    await app.close()
  }
})