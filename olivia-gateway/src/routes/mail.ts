import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createMailProvider } from '../services/providerRegistry.js'

const folderQuery = z.object({ folder: z.string().default('Inbox') })
const sendSchema = z.object({
  to: z.string().min(1),
  cc: z.string().max(4000).optional().default(''),
  bcc: z.string().max(4000).optional().default(''),
  subject: z.string().min(1),
  body: z.string().default(''),
})
const replySchema = z.object({ body: z.string().min(1) })
const forwardSchema = z.object({
  to: z.string().min(1),
  cc: z.string().max(4000).optional().default(''),
  bcc: z.string().max(4000).optional().default(''),
  body: z.string().default(''),
})
const moveSchema = z.object({ folder: z.string().min(1) })
const labelsSchema = z.object({ labels: z.array(z.string().min(1).max(60)).max(20) })

export async function registerMailRoutes(app: FastifyInstance) {
  app.get('/api/mail/folders', async (request) => createMailProvider(process.env.MAIL_PROVIDER, request.session).listFolders())

  app.get('/api/mail/messages', async (request) => {
    const { folder } = folderQuery.parse(request.query)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).listMessages(folder)
  })

  app.get('/api/mail/messages/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const message = await createMailProvider(process.env.MAIL_PROVIDER, request.session).getMessage(params.id)
    if (!message) {
      return reply.code(404).send({ message: 'Message not found' })
    }
    return message
  })

  app.post('/api/mail/messages/:id/read', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).markRead(params.id)
  })

  app.post('/api/mail/messages/:id/star', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).toggleStar(params.id)
  })

  app.post('/api/mail/messages/:id/move', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = moveSchema.parse(request.body)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).move(params.id, body.folder)
  })

  app.delete('/api/mail/messages/:id', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).delete(params.id)
  })

  app.get('/api/mail/labels', async (request) => {
    const { folder } = folderQuery.parse(request.query)
    const labels = await createMailProvider(process.env.MAIL_PROVIDER, request.session).listLabels(folder)
    return { labels }
  })

  app.put('/api/mail/messages/:id/labels', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = labelsSchema.parse(request.body)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).setMessageLabels(params.id, body.labels)
  })

  app.post('/api/mail/send', async (request) => {
    const body = sendSchema.parse(request.body)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).sendMessage(body)
  })

  app.post('/api/mail/reply/:id', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = replySchema.parse(request.body)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).reply(params.id, body)
  })

  app.post('/api/mail/reply-all/:id', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = replySchema.parse(request.body)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).replyAll(params.id, body)
  })

  app.post('/api/mail/forward/:id', async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params)
    const body = forwardSchema.parse(request.body)
    return createMailProvider(process.env.MAIL_PROVIDER, request.session).forward(params.id, body)
  })
}
