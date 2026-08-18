import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const taskSchema = z.object({
  title: z.string().min(1),
  dueAt: z.string().nullable().optional(),
})

const opportunitySchema = z.object({
  title: z.string().min(1),
  messageId: z.string().min(1),
  senderName: z.string().min(1),
  senderEmail: z.string().email(),
  company: z.string().optional(),
  estimatedValue: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  tasks: z.array(taskSchema).default([]),
})

export async function registerPulseRoutes(app: FastifyInstance) {
  app.post('/api/pulse/opportunities', async (request, reply) => {
    const body = opportunitySchema.parse(request.body)
    const mailboxEmail = request.session!.email
    const domain = mailboxEmail.split('@')[1] ?? ''

    if (!app.env.pulseCrmApiUrl) {
      request.log.error('PULSE_CRM_API_URL is not configured')
      return reply.code(503).send({ message: 'O7 Pulse CRM temporarily unavailable' })
    }

    let response: Response
    try {
      response = await fetch(`${app.env.pulseCrmApiUrl.replace(/\/$/, '')}/integrations/olivia/opportunities`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-o7-integration-secret': app.env.pulseCrmIntegrationSecret,
        },
        body: JSON.stringify({
          sourceMailbox: mailboxEmail,
          sourceDomain: domain,
          sourceMessageId: body.messageId,
          senderName: body.senderName,
          senderEmail: body.senderEmail,
          company: body.company,
          title: body.title,
          estimatedValue: body.estimatedValue ?? null,
          currency: body.currency ?? null,
          probability: body.confidence ?? null,
          tasks: body.tasks,
          source: 'Olivia One',
        }),
      })
    } catch (error) {
      request.log.error(error)
      return reply.code(503).send({ message: 'O7 Pulse CRM temporarily unavailable' })
    }

    if (!response.ok) {
      request.log.error(`O7 Pulse CRM request failed with status ${response.status}`)
      return reply.code(503).send({ message: 'O7 Pulse CRM temporarily unavailable' })
    }

    const result = await response.json() as { clientId: string; dealId: string | null; taskIds: string[]; duplicate?: boolean }
    return {
      created: true,
      clientId: result.clientId,
      dealId: result.dealId,
      taskIds: result.taskIds ?? [],
    }
  })
}
