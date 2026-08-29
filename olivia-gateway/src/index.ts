import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { getEnv } from './config/env.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerProtectedRoutes } from './routes/protected.js'
import { createMailboxAuthenticator } from './services/providerRegistry.js'
import { requireSession } from './services/session.js'

const env = getEnv()
const app = Fastify({ logger: true })

app.decorate('env', env)
app.decorate('authenticateMailbox', createMailboxAuthenticator(process.env.MAIL_PROVIDER))
app.decorate('requireSession', requireSession())

await app.register(cors, {
  origin: env.appOrigin,
  credentials: true,
})

await app.register(cookie, {
  secret: env.cookieSecret,
})

await app.register(rateLimit, {
  global: true,
  max: env.rateLimitMax,
  timeWindow: '1 minute',
})

app.addHook('onRequest', async (request, reply) => {
  if (request.method === 'GET') return
  if (request.url.startsWith('/api/auth/login')) return

  const csrfCookie = request.cookies.olivia_csrf
  const csrfHeader = request.headers['x-olivia-csrf']

  if (csrfCookie && csrfHeader === csrfCookie) return
  return reply.code(403).send({ message: 'Invalid CSRF token' })
})

await registerAuthRoutes(app)
await registerProtectedRoutes(app, app.requireSession)

app.get('/health', async () => ({
  status: 'ok',
  provider: process.env.MAIL_PROVIDER ?? 'mock',
}))

await app.listen({ port: env.port, host: env.host })

declare module 'fastify' {
  interface FastifyInstance {
    authenticateMailbox: ReturnType<typeof createMailboxAuthenticator>
    env: ReturnType<typeof getEnv>
    requireSession: ReturnType<typeof requireSession>
  }
}
