import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const csrfToken = randomUUID()

    reply
      .setCookie('olivia_session', `mock:${body.email}`, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      })
      .setCookie('olivia_csrf', csrfToken, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: false,
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
    reply.clearCookie('olivia_session', { path: '/' })
    reply.clearCookie('olivia_csrf', { path: '/' })
    return { ok: true }
  })

  app.get('/api/me', async (request) => {
    const session = request.cookies.olivia_session
    if (!session) {
      return { authenticated: false }
    }

    return {
      authenticated: true,
      user: {
        id: 'user-1',
        name: 'Olivier Steineur',
        email: session.replace('mock:', ''),
      },
    }
  })
}
