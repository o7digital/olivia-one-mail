import type { FastifyInstance } from 'fastify'
import { calendarEvents, contacts } from '../data/mockData.js'

export async function registerPeopleRoutes(app: FastifyInstance) {
  app.get('/api/contacts', async () => contacts)
  app.get('/api/calendar/events', async () => calendarEvents)
}
