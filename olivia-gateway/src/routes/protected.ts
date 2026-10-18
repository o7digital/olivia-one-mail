import { isV3TestMailbox } from '../services/aiRouting.js'
import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { registerDriveRoutes } from './drive.js'
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
    })
    await registerDriveRoutes(protectedApp)
    await registerMailRoutes(protectedApp)
    await registerPeopleRoutes(protectedApp)
    await registerAIRoutes(protectedApp)
    await registerPulseRoutes(protectedApp)
    await registerTaskRoutes(protectedApp)
    await registerIntelligenceRoutes(protectedApp)
  })
}
