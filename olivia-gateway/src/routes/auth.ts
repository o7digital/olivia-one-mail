import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { clearSessionCookies, readSessionEmail, setSessionCookies } from '../services/session.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    if (body.email !== app.env.mailAuthUser || body.password !== app.env.mailAuthPass) {
      return reply.code(401).send({ message: 'Invalid credentials' })
    }

    const csrfToken = randomUUID()
    setSessionCookies({
      reply,
      email: body.email,
      cookieSecret: app.env.cookieSecret,
      csrfToken,
      appOrigin: app.env.appOrigin,
    })

    return {
      user: {
        id: 'user-1',
        name: 'Olivier Steineur',
        email: body.email,
      },
      csrfToken,
    }
  })

  app.post('/api/auth/logout', async (_request, reply) => {
    clearSessionCookies(reply, app.env.appOrigin.startsWith('https://'))
    return { ok: true }
  })

  app.get('/api/me', { preHandler: app.requireSession }, async (request) => {
    const email = readSessionEmail(request.cookies.olivia_session, app.env.cookieSecret)

    return {
      authenticated: true,
      user: {
        id: 'user-1',
        name: 'Olivier Steineur',
        email,
      },
    }
  })
}
