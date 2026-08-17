import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { analyzeMessage } from '../services/aiService.js'
import { createMailProvider } from '../services/providerRegistry.js'

const messageSchema = z.object({
  messageId: z.string().min(1),
})

export async function registerAIRoutes(app: FastifyInstance) {
  app.post('/api/ai/summarize', async (request) => {
    const body = messageSchema.parse(request.body)
    const provider = createMailProvider(process.env.MAIL_PROVIDER, request.session)
    const analysis = await analyzeMessage(provider, request.session!.email, body.messageId)
    return { summary: analysis.summary, urgency: analysis.urgency }
  })

  app.post('/api/ai/suggest-reply', async (request) => {
    const body = messageSchema.parse(request.body)
    const provider = createMailProvider(process.env.MAIL_PROVIDER, request.session)
    const analysis = await analyzeMessage(provider, request.session!.email, body.messageId)
    return { suggestedReply: analysis.suggestedReply }
  })

  app.post('/api/ai/extract-tasks', async (request) => {
    const body = messageSchema.parse(request.body)
    const provider = createMailProvider(process.env.MAIL_PROVIDER, request.session)
    const analysis = await analyzeMessage(provider, request.session!.email, body.messageId)
    return {
      tasks: analysis.tasks,
    }
  })

  app.post('/api/ai/opportunity-score', async (request) => {
    const body = messageSchema.parse(request.body)
    const provider = createMailProvider(process.env.MAIL_PROVIDER, request.session)
    const analysis = await analyzeMessage(provider, request.session!.email, body.messageId)
    return {
      leadScore: analysis.leadScore,
      opportunity: analysis.opportunity,
    }
  })

  app.post('/api/ai/contact-insights', async (request) => {
    const body = messageSchema.parse(request.body)
    const provider = createMailProvider(process.env.MAIL_PROVIDER, request.session)
    const analysis = await analyzeMessage(provider, request.session!.email, body.messageId)
    return {
      summary: analysis.contactInsights.summary,
      urgency: analysis.urgency,
      engagement: analysis.contactInsights.engagement,
      sentiment: analysis.sentiment,
      buyingSignals: analysis.buyingSignals,
    }
  })
}
