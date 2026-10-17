import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import { registerMailRoutes } from './mail.js'

test('mail API paginates favorites across the folder and preserves ordinary pagination', async () => {
  const app = Fastify()
  const previousProvider = process.env.MAIL_PROVIDER
  process.env.MAIL_PROVIDER = 'mock'
  await registerMailRoutes(app)
  try {
    const allResponse = await app.inject('/api/mail/messages?folder=Inbox')
    assert.equal(allResponse.statusCode, 200)
    const all = allResponse.json()
    const favorites = all.filter((message: { starred?: boolean }) => message.starred)
    assert.ok(favorites.length > 0)
    const response = await app.inject('/api/mail/messages?folder=Inbox&starred=true&page=1&pageSize=1')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().messages, favorites.slice(0, 1))
    assert.equal(response.json().pagination.total, favorites.length)
    const ordinary = await app.inject('/api/mail/messages?folder=Inbox&starred=false&page=2&pageSize=1')
    assert.deepEqual(ordinary.json().messages, all.slice(1, 2))
    assert.equal(ordinary.json().pagination.total, all.length)
  } finally {
    if (previousProvider === undefined) delete process.env.MAIL_PROVIDER
    else process.env.MAIL_PROVIDER = previousProvider
    await app.close()
  }
})
