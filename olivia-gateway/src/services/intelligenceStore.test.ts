import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFollowUp, listFollowUps, updateFollowUp } from './intelligenceStore.js'

test('follow-ups persist server-side and remain isolated by authenticated mailbox', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'olivia-intelligence-')), 'data.json')
  const item = await createFollowUp('tenant-a@example.com', { messageId: 'mail-1', threadId: null, contactName: 'Daniel', contactEmail: 'daniel@example.com', subject: 'Proposal', note: null, followUpAt: '2026-09-01T12:00:00.000Z' }, path)
  await createFollowUp('tenant-b@example.com', { messageId: 'mail-2', threadId: null, contactName: null, contactEmail: null, subject: 'Private', note: null, followUpAt: '2026-09-02T12:00:00.000Z' }, path)
  assert.deepEqual((await listFollowUps('tenant-a@example.com', path)).map(({ subject }) => subject), ['Proposal'])
  assert.equal(await updateFollowUp('tenant-b@example.com', item.id, { status: 'dismissed' }, path), null)
  assert.equal((await updateFollowUp('tenant-a@example.com', item.id, { status: 'snoozed' }, path))?.status, 'snoozed')
})
