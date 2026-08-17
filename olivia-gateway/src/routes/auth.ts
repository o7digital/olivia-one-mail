import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authenticateMailbox } from '../services/mailcowAuth.js'
import { buildSessionUser, clearSessionCookies, createServerSession, deleteServerSession, getSignedSessionId, setSessionCookies } from '../services/session.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    try {
      await app.authenticateMailbox({
        email: body.email,
        password: body.password,
      })
    } catch {
      return reply.code(401).send({ message: 'Invalid credentials' })
    }

    const session = createServerSession({
      email: body.email,
      password: body.password,
    })
    const csrfToken = randomUUID()
    setSessionCookies({
      reply,
      sessionId: session.id,
      csrfToken,
      appOrigin: app.env.appOrigin,
    })

    return {
      user: buildSessionUser(body.email),
      csrfToken,
    }
  })

  app.post('/api/auth/logout', async (request, reply) => {
    deleteServerSession(getSignedSessionId(request) ?? undefined)
    clearSessionCookies(reply, app.env.appOrigin.startsWith('https://'))
    return { ok: true }
  })

  app.get('/api/me', { preHandler: app.requireSession }, async (request) => {
    return {
      authenticated: true,
      user: buildSessionUser(request.session!.email),
    }
  })
}
