import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  company: z.string(),
})

const opportunitySchema = z.object({
  title: z.string(),
  messageId: z.string(),
  estimatedValue: z.number(),
  currency: z.string(),
  confirmed: z.literal(true),
})

const taskSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    dueAt: z.string(),
  })),
})

const linkSchema = z.object({
  threadId: z.string(),
  opportunityId: z.string(),
})

export async function registerPulseRoutes(app: FastifyInstance) {
  app.post('/api/pulse/contacts/sync', async (request) => {
    const body = contactSchema.parse(request.body)
    return { synced: true, contactId: `pulse-contact:${body.email}` }
  })

  app.post('/api/pulse/opportunities', async (request) => {
    const body = opportunitySchema.parse(request.body)
    return { created: true, opportunityId: `pulse-opp:${body.messageId}`, confirmed: body.confirmed }
  })

  app.post('/api/pulse/tasks', async (request) => {
    const body = taskSchema.parse(request.body)
    return { created: body.tasks.length }
  })

  app.post('/api/pulse/conversations/link', async (request) => {
    const body = linkSchema.parse(request.body)
    return { linked: true, reference: `${body.opportunityId}:${body.threadId}` }
  })
}
