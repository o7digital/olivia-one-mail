import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTask, deleteTask, listTasks, updateTask } from './taskStore.js'

test('tasks are persisted, isolated by mailbox, completed, and deleted', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'olivia-tasks-'))
  const path = join(directory, 'tasks.json')
  const created = await createTask('owner@example.com', { title: '  Send proposal  ', dueAt: '2026-08-29', priority: 'high' }, path)
  await createTask('other@example.com', { title: 'Private task' }, path)

  assert.equal(created.title, 'Send proposal')
  assert.equal((await listTasks('owner@example.com', path)).length, 1)
  assert.equal((await updateTask('owner@example.com', created.id, { completed: true }, path))?.completed, true)
  assert.equal((await listTasks('other@example.com', path))[0]?.title, 'Private task')
  assert.equal(await deleteTask('owner@example.com', created.id, path), true)
  assert.equal((await listTasks('owner@example.com', path)).length, 0)
  assert.doesNotMatch(await readFile(path, 'utf8'), /Send proposal/)
})
