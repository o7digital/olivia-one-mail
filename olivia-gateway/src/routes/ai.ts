import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { analyzeMessage, composeDraft, rewriteDraft } from '../services/aiService.js'
import { createMailProvider } from '../services/providerRegistry.js'

const messageSchema = z.object({
  messageId: z.string().min(1),
})
const rewriteSchema = z.object({
  draft: z.string().min(1),
  action: z.enum(['shorter', 'longer', 'formal', 'friendly', 'translate-fr', 'translate-es', 'translate-en', 'improve']),
  recipient: z.string().optional(),
  subject: z.string().optional(),
})
const composeSchema = z.object({
  prompt: z.string().min(1),
  recipient: z.string().optional(),
  subject: z.string().optional(),
  currentDraft: z.string().optional(),
})

export async function registerAIRoutes(app: FastifyInstance) {
  app.post('/api/ai/analyze', async (request, reply) => {
    const body = messageSchema.parse(request.body)
    const provider = createMailProvider(process.env.MAIL_PROVIDER, request.session)
    try {
      return await analyzeMessage(provider, request.session!.email, body.messageId, app.env)
    } catch (error) {
      request.log.error(error)
      return reply.code(503).send({ message: 'Olivia AI temporarily unavailable' })
    }
  })

  app.post('/api/ai/rewrite', async (request, reply) => {
    const body = rewriteSchema.parse(request.body)
    try {
      return await rewriteDraft(app.env, {
        mailboxEmail: request.session!.email,
        action: body.action,
        draft: body.draft,
        recipient: body.recipient,
        subject: body.subject,
      })
    } catch (error) {
      request.log.error(error)
      return reply.code(503).send({ message: 'Olivia AI temporarily unavailable' })
    }
  })

  app.post('/api/ai/compose', async (request, reply) => {
    const body = composeSchema.parse(request.body)
    try {
      return await composeDraft(app.env, {
        mailboxEmail: request.session!.email,
        prompt: body.prompt,
        recipient: body.recipient,
        subject: body.subject,
        currentDraft: body.currentDraft,
      })
    } catch (error) {
      request.log.error(error)
      return reply.code(503).send({ message: 'Olivia AI temporarily unavailable' })
    }
  })
}
