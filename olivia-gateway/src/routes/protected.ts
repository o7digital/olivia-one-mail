import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { registerAIRoutes } from './ai.js'
import { registerMailRoutes } from './mail.js'
import { registerPeopleRoutes } from './people.js'
import { registerPulseRoutes } from './pulse.js'
import type { MailProvider } from '../providers/mailProvider.js'

export async function registerProtectedRoutes(app: FastifyInstance, provider: MailProvider, requireAuth: preHandlerHookHandler) {
  await app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', requireAuth)
    await registerMailRoutes(protectedApp, provider)
    await registerPeopleRoutes(protectedApp)
    await registerAIRoutes(protectedApp)
    await registerPulseRoutes(protectedApp)
  })
}
