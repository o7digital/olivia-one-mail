import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import { registerProtectedRoutes } from './protected.js'
import { getEnv } from '../config/env.js'

test('all Drive endpoints require authentication and uploads validate names and encoding', async () => {
  const app = Fastify()
  app.decorate('env', getEnv())
  await registerProtectedRoutes(app, async (request, reply) => {
    if (request.headers.authorization !== 'test-session') return reply.code(401).send({ message: 'Authentication required' })
    request.session = { id: 'session', email: 'alice@example.com', password: 'secret', createdAt: 0, expiresAt: Date.now() + 10000 }
  })
  try {
    for (const [method, url] of [['GET', '/api/drive'], ['POST', '/api/drive'], ['GET', '/api/drive/7-42'], ['DELETE', '/api/drive/7-42']] as const) {
      assert.equal((await app.inject({ method, url, ...(method === 'POST' ? { payload: {} } : {}) })).statusCode, 401)
    }
    for (const payload of [{ name: '../secret', contentBase64: 'aGVsbG8=' }, { name: 'bad\r\nheader', contentBase64: '' }, { name: 'hello', contentBase64: '???' }, { name: 'hello', contentBase64: 'aaaa=' }, { name: 'hello', contentBase64: 'ab==' }]) {
      assert.equal((await app.inject({ method: 'POST', url: '/api/drive', headers: { authorization: 'test-session' }, payload })).statusCode, 400)
    }
  } finally { await app.close() }
})
