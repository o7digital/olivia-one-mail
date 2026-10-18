import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { simpleParser } from 'mailparser'
import { getMailcowConnectionConfig, type MailboxCredentials } from './mailcowAuth.js'

// MIME attachments live in the mailbox so Dovecot enforces the same quota for
// mail delivery and Drive uploads, including concurrent writes and MIME overhead.
export const DRIVE_FOLDER = 'Olivia Drive'
export const MAX_DRIVE_BYTES = 20 * 1024 * 1024
export class DriveError extends Error {
  constructor(public statusCode: number, message: string) { super(message) }
}
export interface DriveFile { id: string; name: string; size: number; createdAt: string }

export function createDriveStore(credentials: MailboxCredentials, makeClient?: () => any) {
  const connect = makeClient ?? (() => {
    const config = getMailcowConnectionConfig()
    return new ImapFlow({ logger: false, host: config.imapHost, port: config.imapPort, secure: config.imapSecure,
      auth: { user: credentials.email, pass: credentials.password }, connectionTimeout: 8000, socketTimeout: 30000 })
  })
  async function run<T>(action: (client: any) => Promise<T>): Promise<T> {
    const client = connect()
    try { await client.connect(); return await action(client) }
    catch (error) {
      if (error instanceof DriveError) throw error
      if (/quota|OVERQUOTA/i.test(String((error as any).responseText ?? (error as Error).message))) throw new DriveError(413, 'Your shared mail and Drive storage is full.')
      throw new DriveError(503, 'Drive is temporarily unavailable. Please try again.')
    } finally { await client.logout().catch(() => {}) }
  }
  async function open(client: any, create = false) {
    const folders = await client.list()
    if (!folders.some((folder: any) => folder.path === DRIVE_FOLDER)) {
      if (!create) return false
      try { await client.mailboxCreate(DRIVE_FOLDER) } catch (error) {
        if (!(await client.list()).some((folder: any) => folder.path === DRIVE_FOLDER)) throw error
      }
    }
    await client.mailboxOpen(DRIVE_FOLDER)
    return true
  }
  async function quota(client: any) {
    const result = await client.getQuota('INBOX')
    const storage = result && result.storage
    if (!storage || !Number.isFinite(storage.limit) || storage.limit <= 0 || !Number.isFinite(storage.used)) return null
    return { used: storage.used, limit: storage.limit }
  }
  async function select(client: any, id: string) {
    const match = /^(\d+)-(\d+)$/.exec(id)
    if (!match || !await open(client) || String(client.mailbox.uidValidity) !== match[1]) throw new DriveError(404, 'File not found')
    return match[2]
  }
  return {
    storage: () => run(async (client) => ({ storage: await quota(client) })),
    list: () => run(async (client) => {
      const storage = await quota(client)
      const files: DriveFile[] = []
      if (await open(client) && client.mailbox.exists) {
        for await (const message of client.fetch('1:*', { envelope: true, internalDate: true, size: true })) {
          files.push({ id: `${client.mailbox.uidValidity}-${message.uid}`, name: message.envelope?.subject || 'File', size: message.size,
            createdAt: new Date(message.internalDate).toISOString() })
        }
      }
      return { files: files.reverse(), storage, maxFileBytes: MAX_DRIVE_BYTES }
    }),
    upload: (name: string, content: Buffer) => run(async (client) => {
      const storage = await quota(client)
      if (!storage) throw new DriveError(503, 'Your shared storage quota could not be verified. Please try again later.')
      const compiler = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' })
      const compiled = await compiler.sendMail({ from: credentials.email, to: credentials.email, subject: name,
        text: 'File stored in Olivia One Drive.', attachments: [{ filename: name, content, contentType: 'application/octet-stream' }] })
      const raw = Buffer.from(compiled.message)
      if (storage.used + raw.length > storage.limit) throw new DriveError(413, 'Not enough shared mail and Drive storage.')
      await open(client, true)
      // APPEND is atomic and the mail server makes the final quota decision.
      if (!await client.append(DRIVE_FOLDER, raw, ['\\Seen'])) throw new DriveError(503, 'File could not be saved.')
      return { uploaded: true }
    }),
    download: (id: string) => run(async (client) => {
      const uid = await select(client, id)
      const message = await client.fetchOne(uid, { source: true }, { uid: true })
      if (!message?.source) throw new DriveError(404, 'File not found')
      const parsed = await simpleParser(message.source)
      const attachment = parsed.attachments?.[0]
      if (!attachment) throw new DriveError(404, 'File not found')
      return { name: attachment.filename || 'file', content: attachment.content as Buffer }
    }),
    delete: (id: string) => run(async (client) => {
      const uid = await select(client, id)
      if (!client.capabilities.has('UIDPLUS')) throw new DriveError(503, 'Safe file deletion is unavailable on this mail server.')
      if (!await client.fetchOne(uid, { uid: true }, { uid: true })) throw new DriveError(404, 'File not found')
      if (!await client.messageDelete(uid, { uid: true })) throw new DriveError(503, 'File could not be deleted.')
      return { deleted: true }
    }),
  }
}
