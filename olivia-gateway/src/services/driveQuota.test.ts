import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type Socket } from 'node:net'
import { once } from 'node:events'
import { ImapFlow } from 'imapflow'
import { createDriveStore } from './driveStore.js'

test('the real ImapFlow quota response supplies usage and enables Drive uploads', { timeout: 10000 }, async () => {
  const sockets = new Set<Socket>()
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.write('* PREAUTH [CAPABILITY IMAP4rev1 QUOTA] Drive quota fixture\r\n')
    let buffer = ''
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      let end: number
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2)
        const [tag, command] = line.split(' ')
        if (command === 'CAPABILITY') socket.write(`* CAPABILITY IMAP4rev1 QUOTA\r\n${tag} OK capabilities\r\n`)
        else if (command === 'LIST') socket.write(`* LIST (\\Noselect) "/" ""\r\n${tag} OK list\r\n`)
        else if (command === 'GETQUOTAROOT') socket.write(`* QUOTAROOT INBOX ""\r\n* QUOTA "" (STORAGE 80 5000)\r\n${tag} OK quota\r\n`)
        else if (command === 'LOGOUT') socket.end(`* BYE goodbye\r\n${tag} OK logout\r\n`)
        else socket.write(`${tag} OK done\r\n`)
      }
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as { port: number }
  const store = createDriveStore({ email: 'test@example.com', password: 'test' }, () => new ImapFlow({
    host: '127.0.0.1', port: address.port, secure: false, doSTARTTLS: false, logger: false,
    auth: { user: 'test@example.com', pass: 'test' }, socketTimeout: 3000,
  }))
  try { assert.deepEqual(await store.storage(), { storage: { used: 80 * 1024, limit: 5000 * 1024 } }) }
  finally { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve) => server.close(() => resolve())) }
})
