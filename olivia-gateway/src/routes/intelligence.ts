import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createMailProvider } from '../services/providerRegistry.js'
import { createFollowUp, listFollowUps, updateFollowUp } from '../services/intelligenceStore.js'
import { listTasks } from '../services/taskStore.js'

const createSchema = z.object({
  messageId: z.string().min(1), threadId: z.string().nullable().default(null),
  contactName: z.string().nullable().default(null), contactEmail: z.string().email().nullable().default(null),
  subject: z.string().default(''), note: z.string().max(500).nullable().default(null), followUpAt: z.string().datetime(),
})
const updateSchema = z.object({
  followUpAt: z.string().datetime().optional(), note: z.string().max(500).nullable().optional(),
  status: z.enum(['waiting', 'snoozed', 'dismissed', 'done']).optional(),
})
const askSchema = z.object({ query: z.string().trim().min(2).max(500) })

export async function registerIntelligenceRoutes(app: FastifyInstance) {
  app.get('/api/follow-ups', (request) => listFollowUps(request.session!.email))
  app.post('/api/follow-ups', async (request, reply) => reply.code(201).send(await createFollowUp(request.session!.email, createSchema.parse(request.body))))
  app.patch('/api/follow-ups/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const item = await updateFollowUp(request.session!.email, id, updateSchema.parse(request.body))
    return item ?? reply.code(404).send({ message: 'Follow-up not found' })
  })

  app.post('/api/ask', async (request) => {
    const { query } = askSchema.parse(request.body)
    const ignored = new Set(['what', 'which', 'where', 'when', 'show', 'find', 'from', 'with', 'about', 'have', 'this', 'that', 'pour', 'avec', 'dans', 'quoi', 'quel', 'quelle', 'mes', 'les', 'des', 'une'])
    const tokens = query.toLocaleLowerCase().split(/[^\p{L}\p{N}@.-]+/u).filter((token) => token.length > 2 && !ignored.has(token))
    const matches = (value: string) => tokens.length > 0 && tokens.some((token) => value.toLocaleLowerCase().includes(token))
    const provider = createMailProvider(process.env.MAIL_PROVIDER, request.session)
    const folders = await provider.listFolders()
    const messages = (await Promise.all(folders.slice(0, 8).map((folder) => provider.listMessages(folder.label)))).flat()
    const tasks = await listTasks(request.session!.email)
    const emailSources = messages.filter((message) => matches([message.subject, message.sender, message.email, message.preview, ...message.body].join(' '))).slice(0, 8).map((message) => ({ type: 'email' as const, messageId: message.id, title: message.subject, date: message.receivedAt ?? message.time, folder: message.folder, category: message.category ?? 'focused' }))
    const taskSources = tasks.filter((task) => matches(task.title)).slice(0, 8).map((task) => ({ type: 'task' as const, taskId: task.id, title: task.title, date: task.dueAt }))
    const sources = [...emailSources, ...taskSources]
    return {
      answer: sources.length ? `I found ${sources.length} matching ${sources.length === 1 ? 'item' : 'items'} in your connected mail and tasks.` : 'I could not find matching information in the connected data currently available.',
      sources,
      coverage: { email: true, tasks: true, calendar: false, contacts: false, pulse: false },
    }
  })
}
