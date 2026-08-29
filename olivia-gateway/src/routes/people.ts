import type { FastifyInstance } from 'fastify'
import { calendarEvents, contacts } from '../data/mockData.js'

export async function registerPeopleRoutes(app: FastifyInstance) {
  const isDevelopmentMock = (process.env.MAIL_PROVIDER ?? 'mock') === 'mock'
  app.get('/api/contacts', async (_request, reply) => isDevelopmentMock ? contacts : reply.code(503).send({ message: 'Contacts provider temporarily unavailable' }))
  app.get('/api/calendar/events', async (_request, reply) => isDevelopmentMock ? calendarEvents : reply.code(503).send({ message: 'Calendar provider temporarily unavailable' }))
}
