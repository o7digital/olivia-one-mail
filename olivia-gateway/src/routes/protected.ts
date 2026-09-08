import { isV3TestMailbox } from '../services/aiRouting.js'
import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { registerAIRoutes } from './ai.js'
import { registerMailRoutes } from './mail.js'
import { registerPeopleRoutes } from './people.js'
import { registerPulseRoutes } from './pulse.js'
import { registerTaskRoutes } from './tasks.js'
import { registerIntelligenceRoutes } from './intelligence.js'

export async function registerProtectedRoutes(app: FastifyInstance, requireAuth: preHandlerHookHandler) {
  await app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', requireAuth)
    protectedApp.addHook('preHandler', async (request, reply) => {
      if (app.env.aiV3TestOnly && request.session && !isV3TestMailbox(request.session.email, app.env)) return reply.code(403).send({ code: 'TEST_MAILBOX_ONLY', message: 'Internal test mailbox required' })
      if (request.session && isV3TestMailbox(request.session.email, app.env) && request.method !== 'GET' && !['/api/ai/analyze', '/api/ai/rewrite', '/api/ai/compose'].includes(request.url.split('?')[0])) {
        return reply.code(403).send({ code: 'SANDBOX_READ_ONLY', message: 'Test mailbox is read-only; no external action was executed' })
      }
    })
    await registerMailRoutes(protectedApp)
    await registerPeopleRoutes(protectedApp)
    await registerAIRoutes(protectedApp)
    await registerPulseRoutes(protectedApp)
    await registerTaskRoutes(protectedApp)
    await registerIntelligenceRoutes(protectedApp)
  })
}
