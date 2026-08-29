import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type TaskPriority = 'low' | 'normal' | 'high'

export interface WorkspaceTask {
  id: string
  ownerEmail: string
  title: string
  dueAt: string | null
  priority: TaskPriority
  completed: boolean
  createdAt: string
  sourceMessageId: string | null
}

const defaultPath = process.env.TASK_DATA_PATH || '/tmp/olivia-one-tasks.json'
let writeQueue = Promise.resolve()

async function readTasks(path = defaultPath): Promise<WorkspaceTask[]> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as WorkspaceTask[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function persistTasks(tasks: WorkspaceTask[], path = defaultPath) {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp`
  await writeFile(temporaryPath, JSON.stringify(tasks, null, 2), { mode: 0o600 })
  await rename(temporaryPath, path)
}

function mutateTasks<T>(mutation: (tasks: WorkspaceTask[]) => Promise<T> | T, path = defaultPath): Promise<T> {
  const operation = writeQueue.then(async () => {
    const tasks = await readTasks(path)
    const result = await mutation(tasks)
    await persistTasks(tasks, path)
    return result
  })
  writeQueue = operation.then(() => undefined, () => undefined)
  return operation
}

export async function listTasks(ownerEmail: string, path = defaultPath) {
  const tasks = await readTasks(path)
  return tasks
    .filter((task) => task.ownerEmail.toLowerCase() === ownerEmail.toLowerCase())
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || b.createdAt.localeCompare(a.createdAt))
}

export function createTask(ownerEmail: string, input: { title: string; dueAt?: string | null; priority?: TaskPriority; sourceMessageId?: string | null }, path = defaultPath) {
  return mutateTasks((tasks) => {
    const task: WorkspaceTask = {
      id: randomUUID(),
      ownerEmail,
      title: input.title.trim(),
      dueAt: input.dueAt || null,
      priority: input.priority || 'normal',
      completed: false,
      createdAt: new Date().toISOString(),
      sourceMessageId: input.sourceMessageId ?? null,
    }
    tasks.push(task)
    return task
  }, path)
}

export function updateTask(ownerEmail: string, id: string, input: { completed: boolean }, path = defaultPath) {
  return mutateTasks((tasks) => {
    const task = tasks.find((item) => item.id === id && item.ownerEmail.toLowerCase() === ownerEmail.toLowerCase())
    if (!task) return null
    task.completed = input.completed
    return task
  }, path)
}

export function deleteTask(ownerEmail: string, id: string, path = defaultPath) {
  return mutateTasks((tasks) => {
    const index = tasks.findIndex((item) => item.id === id && item.ownerEmail.toLowerCase() === ownerEmail.toLowerCase())
    if (index === -1) return false
    tasks.splice(index, 1)
    return true
  }, path)
}
