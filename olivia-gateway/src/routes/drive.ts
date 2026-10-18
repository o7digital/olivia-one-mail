import type { FastifyInstance } from 'fastify'
import { createDriveStore, DriveError, MAX_DRIVE_BYTES } from '../services/driveStore.js'

export async function registerDriveRoutes(app: FastifyInstance) {
  const store = (request: any) => {
    if (process.env.MAIL_PROVIDER !== 'mailcow-imap') throw new DriveError(503, 'Drive requires a connected Mailcow mailbox.')
    return createDriveStore(request.session)
  }
  app.get('/api/drive/storage', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store')
    return store(request).storage()
  })
  app.get('/api/drive', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store')
    return store(request).list()
  })
  app.post('/api/drive', { bodyLimit: Math.ceil(MAX_DRIVE_BYTES * 4 / 3) + 4096 }, async (request, reply) => {
    const { name, contentBase64 } = (request.body || {}) as Record<string, unknown>
    if (typeof name !== 'string' || !name.trim() || name.length > 240 || /[\x00-\x1f\x7f/\\]/.test(name)
      || typeof contentBase64 !== 'string' || (contentBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64))) {
      return reply.code(400).send({ message: 'Invalid file or filename' })
    }
    const content = Buffer.from(contentBase64, 'base64')
    if (content.toString('base64') !== contentBase64) return reply.code(400).send({ message: 'Invalid file encoding' })
    if (content.length > MAX_DRIVE_BYTES) return reply.code(413).send({ message: 'Files must be 20 MB or smaller.' })
    return reply.code(201).send(await store(request).upload(name.trim(), content))
  })
  app.get<{ Params: { id: string } }>('/api/drive/:id', async (request, reply) => {
    const file = await store(request).download(request.params.id)
    return reply.header('Content-Type', 'application/octet-stream').header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, no-store').header('Content-Disposition', `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)}`).send(file.content)
  })
  app.delete<{ Params: { id: string } }>('/api/drive/:id', async (request) => store(request).delete(request.params.id))
}
