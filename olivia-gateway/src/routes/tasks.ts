import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createTask, deleteTask, listTasks, updateTask } from '../services/taskStore.js'

const createSchema = z.object({
  title: z.string().trim().min(1).max(240),
  dueAt: z.string().date().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
})

const updateSchema = z.object({ completed: z.boolean() })

export async function registerTaskRoutes(app: FastifyInstance) {
  app.get('/api/tasks', async (request) => listTasks(request.session!.email))

  app.post('/api/tasks', async (request, reply) => {
    const input = createSchema.parse(request.body)
    const task = await createTask(request.session!.email, input)
    return reply.code(201).send(task)
  })

  app.patch('/api/tasks/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const task = await updateTask(request.session!.email, id, updateSchema.parse(request.body))
    if (!task) return reply.code(404).send({ message: 'Task not found' })
    return task
  })

  app.delete('/api/tasks/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    if (!await deleteTask(request.session!.email, id)) return reply.code(404).send({ message: 'Task not found' })
    return { id, deleted: true }
  })
}
