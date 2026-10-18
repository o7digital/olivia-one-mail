import assert from 'node:assert/strict'
import test from 'node:test'
import { createDriveStore, DRIVE_FOLDER } from './driveStore.js'

function fixture() {
  const state = { raw: null as Buffer | null, used: 0, limit: 1024 * 1024, exists: false, deleted: false, quotaAvailable: true, serverFull: false }
  const client = {
    capabilities: new Map([['UIDPLUS', true]]), mailbox: { uidValidity: 7n, exists: 1 },
    connect: async () => {}, logout: async () => {},
    list: async () => state.exists ? [{ path: DRIVE_FOLDER }] : [],
    mailboxCreate: async () => { state.exists = true }, mailboxOpen: async () => {},
    getQuota: async () => state.quotaAvailable ? { storage: { used: state.used, limit: state.limit } } : false,
    append: async (_folder: string, raw: Buffer) => {
      if (state.serverFull) throw Object.assign(new Error('Append rejected'), { responseText: 'NO [OVERQUOTA] Quota exceeded' })
      state.raw = raw; return { uid: 42 }
    },
    fetchOne: async () => state.raw ? { source: state.raw, uid: 42 } : false,
    messageDelete: async () => { state.deleted = true; return true },
    async *fetch() { if (state.raw) yield { uid: 42, envelope: { subject: 'résumé.txt' }, size: state.raw.length, internalDate: new Date('2026-10-17') } },
  }
  return { state, client, store: createDriveStore({ email: 'alice@example.com', password: 'secret' }, () => client) }
}

test('Drive round-trips binary attachments inside the mailbox and exposes shared quota', async () => {
  const { state, store } = fixture()
  const content = Buffer.from([0, 255, 1, 42])
  await store.upload('résumé.txt', content)
  assert.ok(state.raw!.length > content.length)
  const result = await store.list()
  assert.deepEqual(result.storage, { used: 0, limit: state.limit })
  assert.equal(result.files[0].id, '7-42')
  assert.equal(result.files[0].size, state.raw!.length)
  const file = await store.download('7-42')
  assert.equal(file.name, 'résumé.txt')
  assert.deepEqual(file.content, content)
  await store.delete('7-42')
  assert.equal(state.deleted, true)
})

test('quota includes existing mail usage and full encoded message size', async () => {
  const { state, store } = fixture()
  state.used = state.limit - 100
  await assert.rejects(store.upload('file.txt', Buffer.from('hello')), /Not enough shared/)
  assert.equal(state.raw, null)
})

test('uploads fail closed when quota cannot be verified', async () => {
  const { state, store } = fixture()
  state.quotaAvailable = false
  await assert.rejects(store.upload('file.txt', Buffer.from('hello')), /could not be verified/)
  assert.equal(state.exists, false)
})

test('server quota rejection still wins when another writer fills the mailbox', async () => {
  const { state, store } = fixture()
  state.serverFull = true
  await assert.rejects(store.upload('file.txt', Buffer.from('hello')), /storage is full/)
  assert.equal(state.raw, null)
})

test('stale IDs, injected mailbox paths and missing files cannot access messages', async () => {
  const { store } = fixture()
  for (const id of ['6-42', '../INBOX/42', '7-42', '7-1:*']) await assert.rejects(store.download(id), /File not found/)
})

test('deletion refuses servers without targeted UID expunge', async () => {
  const { store, client } = fixture()
  await store.upload('file.txt', Buffer.from('hello'))
  client.capabilities.clear()
  await assert.rejects(store.delete('7-42'), /Safe file deletion/)
})
