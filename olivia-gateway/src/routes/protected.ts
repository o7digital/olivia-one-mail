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
    await registerMailRoutes(protectedApp)
    await registerPeopleRoutes(protectedApp)
    await registerAIRoutes(protectedApp)
    await registerPulseRoutes(protectedApp)
    await registerTaskRoutes(protectedApp)
    await registerIntelligenceRoutes(protectedApp)
  })
}
