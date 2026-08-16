import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { MailProvider } from '../providers/mailProvider.js'

const folderQuery = z.object({ folder: z.string().default('Inbox') })
const sendSchema = z.object({
  to: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().default(''),
})
const replySchema = z.object({ body: z.string().min(1) })
const forwardSchema = z.object({ to: z.string().min(1), body: z.string().default('') })
const moveSchema = z.object({ folder: z.string().min(1) })

export async function registerMailRoutes(app: FastifyInstance, provider: MailProvider) {
  app.get('/api/mail/folders', async () => provider.listFolders())

  app.get('/api/mail/messages', async (request) => {
    const { folder } = folderQuery.parse(request.query)
    return provider.listMessages(folder)
  })

  app.get('/api/mail/messages/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const message = await provider.getMessage(params.id)
    if (!message) {
      return reply.code(404).send({ message: 'Message not found' })
    }
    return message
  })

  app.post('/api/mail/messages/:id/read', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    return provider.markRead(params.id)
  })

  app.post('/api/mail/messages/:id/star', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    return provider.toggleStar(params.id)
  })

  app.post('/api/mail/messages/:id/move', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = moveSchema.parse(request.body)
    return provider.move(params.id, body.folder)
  })

  app.delete('/api/mail/messages/:id', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    return provider.delete(params.id)
  })

  app.post('/api/mail/send', async (request) => {
    const body = sendSchema.parse(request.body)
    return provider.sendMessage(body)
  })

  app.post('/api/mail/reply/:id', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = replySchema.parse(request.body)
    return provider.reply(params.id, body)
  })

  app.post('/api/mail/forward/:id', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = forwardSchema.parse(request.body)
    return provider.forward(params.id, body)
  })
}
