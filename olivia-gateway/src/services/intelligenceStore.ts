import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface FollowUp {
  id: string
  ownerEmail: string
  messageId: string
  threadId: string | null
  contactName: string | null
  contactEmail: string | null
  subject: string
  note: string | null
  followUpAt: string
  status: 'waiting' | 'snoozed' | 'dismissed' | 'done'
  createdAt: string
  updatedAt: string
}

const defaultPath = process.env.INTELLIGENCE_DATA_PATH || '/tmp/olivia-one-intelligence.json'
let queue = Promise.resolve<unknown>(undefined)

async function readItems(path = defaultPath): Promise<FollowUp[]> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    return Array.isArray(parsed.followUps) ? parsed.followUps : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function persist(items: FollowUp[], path = defaultPath) {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.tmp`
  await writeFile(temporaryPath, JSON.stringify({ version: 1, followUps: items }, null, 2), { mode: 0o600 })
  await rename(temporaryPath, path)
}

function mutate<T>(fn: (items: FollowUp[]) => T | Promise<T>, path = defaultPath): Promise<T> {
  const operation = queue.then(async () => {
    const items = await readItems(path)
    const result = await fn(items)
    await persist(items, path)
    return result
  })
  queue = operation.catch(() => undefined)
  return operation
}

const owns = (item: FollowUp, ownerEmail: string) => item.ownerEmail.toLowerCase() === ownerEmail.toLowerCase()

export async function listFollowUps(ownerEmail: string, path = defaultPath) {
  return (await readItems(path)).filter((item) => owns(item, ownerEmail)).sort((a, b) => a.followUpAt.localeCompare(b.followUpAt))
}

export function createFollowUp(ownerEmail: string, input: Omit<FollowUp, 'id' | 'ownerEmail' | 'createdAt' | 'updatedAt' | 'status'> & { status?: FollowUp['status'] }, path = defaultPath) {
  return mutate((items) => {
    const now = new Date().toISOString()
    const item: FollowUp = { ...input, id: randomUUID(), ownerEmail, status: input.status ?? 'waiting', createdAt: now, updatedAt: now }
    items.push(item)
    return item
  }, path)
}

export function updateFollowUp(ownerEmail: string, id: string, input: Partial<Pick<FollowUp, 'followUpAt' | 'note' | 'status'>>, path = defaultPath) {
  return mutate((items) => {
    const item = items.find((candidate) => candidate.id === id && owns(candidate, ownerEmail))
    if (!item) return null
    Object.assign(item, input, { updatedAt: new Date().toISOString() })
    return item
  }, path)
}
