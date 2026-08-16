import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { buildSuggestedReply, getAnalysis } from '../services/aiService.js'

const messageSchema = z.object({
  messageId: z.string().optional(),
})

export async function registerAIRoutes(app: FastifyInstance) {
  app.post('/api/ai/summarize', async (request) => {
    const body = messageSchema.parse(request.body)
    const analysis = getAnalysis(body.messageId)
    return { summary: analysis.summary, urgency: analysis.urgency }
  })

  app.post('/api/ai/suggest-reply', async (request) => {
    const body = messageSchema.parse(request.body)
    return { suggestedReply: buildSuggestedReply(body.messageId) }
  })

  app.post('/api/ai/extract-tasks', async (request) => {
    const body = messageSchema.parse(request.body)
    const analysis = getAnalysis(body.messageId)
    return {
      tasks: analysis.tasks.map((title, index) => ({
        title,
        dueAt: `2026-08-${String(18 + index).padStart(2, '0')}T16:00:00.000Z`,
      })),
    }
  })

  app.post('/api/ai/opportunity-score', async (request) => {
    const body = messageSchema.parse(request.body)
    const analysis = getAnalysis(body.messageId)
    return {
      leadScore: analysis.leadScore,
      opportunity: {
        detected: true,
        title: analysis.opportunity.title,
        estimatedValue: Number(analysis.opportunity.value.replace(/[$,]/g, '')),
        currency: 'USD',
        confidence: analysis.opportunity.confidence === 'High potential' ? 0.91 : 0.68,
      },
    }
  })

  app.post('/api/ai/contact-insights', async (request) => {
    const body = messageSchema.parse(request.body)
    const analysis = getAnalysis(body.messageId)
    return {
      summary: analysis.summary.join(' '),
      urgency: analysis.urgency,
      engagement: 'Strong engagement in the last 30 days',
    }
  })
}
