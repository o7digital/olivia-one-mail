import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { getEnv } from './config/env.js'
import { registerAIRoutes } from './routes/ai.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerMailRoutes } from './routes/mail.js'
import { registerPeopleRoutes } from './routes/people.js'
import { registerPulseRoutes } from './routes/pulse.js'
import { createMailProvider } from './services/providerRegistry.js'

const env = getEnv()
const app = Fastify({ logger: true })
const provider = createMailProvider()

await app.register(cors, {
  origin: env.appOrigin,
  credentials: true,
})

await app.register(cookie, {
  secret: env.cookieSecret,
})

await app.register(rateLimit, {
  global: true,
  max: 100,
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
await registerMailRoutes(app, provider)
await registerPeopleRoutes(app)
await registerAIRoutes(app)
await registerPulseRoutes(app)

app.get('/health', async () => ({
  status: 'ok',
  provider: process.env.MAIL_PROVIDER ?? 'mock',
  configuredUser: process.env.MAIL_AUTH_USER ?? null,
}))

await app.listen({ port: env.port, host: env.host })
