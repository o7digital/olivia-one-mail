import { expect, test } from '@playwright/test'

for (const email of ['user@zevicapital.com', 'user@another-domain.example']) {
  test(`sent mail synchronizes without refresh for ${email}`, async ({ page }) => {
    let sent = false
    let sentReads = 0
    let listReads = 0
    let navigationCount = 0
    page.on('request', request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigationCount += 1
    })
    const message = { id: 'sent-test', folder: 'Sent', sender: 'Me', email, subject: 'Automatic sent copy', preview: 'Sent content', body: ['Sent content'], receivedAt: '2026-10-17T12:00:00Z', unread: false, starred: false, labels: [], attachments: [] }
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ status: 503, json: { message: 'AI unavailable in sync fixture' } })
      let json = []
      if (url.pathname === '/api/me') json = { authenticated: true, user: { email, name: 'Sync test' } }
      if (url.pathname === '/api/mail/folders') json = [{ label: 'Inbox', count: 0 }, { label: 'Sent', count: sent ? 1 : 0 }]
      if (url.pathname === '/api/mail/messages') {
        listReads += 1
        if (url.searchParams.get('folder') === 'Sent' && sent) sentReads += 1
        // The first read after SMTP succeeds happens before the IMAP copy arrives.
        const messages = url.searchParams.get('folder') === 'Sent' && sentReads >= 2 ? [message] : []
        json = { messages, pagination: { page: 1, pageSize: 25, total: messages.length, totalPages: messages.length ? 1 : 0 } }
      }
      if (url.pathname === '/api/mail/send') { sent = true; json = { id: 'smtp-test', status: 'sent' } }
      if (url.pathname === '/api/mail/messages/sent-test') json = message
      return route.fulfill({ json })
    })
    await page.goto(process.env.COMPOSER_ORIGIN ? new URL('/mail', process.env.COMPOSER_ORIGIN).href : '/mail', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Sent', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sent', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Compose', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New Message' })
    await dialog.getByRole('textbox', { name: 'Recipient' }).fill('recipient@example.com')
    await dialog.getByRole('textbox', { name: 'Subject' }).fill(message.subject)
    await dialog.getByRole('textbox', { name: 'Message body' }).fill('Sent content')
    const readsBeforeSending = listReads
    await dialog.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => listReads).toBeGreaterThan(readsBeforeSending)
    await expect(page.locator('.mailrow').filter({ hasText: message.subject })).toBeVisible({ timeout: 12000 })
    await expect(page.getByRole('button', { name: 'Sent 1', exact: true })).toBeVisible()
    expect(navigationCount).toBe(1)
  })
}

test('incoming mail appears automatically while the current message stays visible', async ({ page }) => {
  let incoming = false
  let holdRefresh
  let releaseRefresh
  const oldMessage = { id: 'existing', folder: 'Inbox', sender: 'Existing sender', email: 'existing@example.com', subject: 'Keep this message visible', preview: 'Existing content', body: ['Existing content'], receivedAt: '2026-10-16T12:00:00Z', unread: false, starred: false, labels: [], attachments: [] }
  const newMessage = { ...oldMessage, id: 'incoming', sender: 'New sender', subject: 'New incoming email', receivedAt: '2026-10-17T12:00:00Z' }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.startsWith('/api/ai/')) return route.fulfill({ status: 503, json: { message: 'AI unavailable in sync fixture' } })
    let json = []
    if (path === '/api/me') json = { authenticated: true, user: { email: 'live@another-domain.example', name: 'Live inbox' } }
    if (path === '/api/mail/folders') json = [{ label: 'Inbox', count: incoming ? 2 : 1 }, { label: 'Sent' }]
    if (path === '/api/mail/messages') {
      if (incoming && holdRefresh) { holdRefresh(); await new Promise(resolve => { releaseRefresh = resolve }) }
      const messages = incoming ? [newMessage, oldMessage] : [oldMessage]
      json = { messages, pagination: { page: 1, pageSize: 25, total: messages.length, totalPages: 1 } }
    }
    if (path === '/api/mail/messages/existing') json = oldMessage
    return route.fulfill({ json })
  })
  await page.goto(process.env.COMPOSER_ORIGIN ? new URL('/mail', process.env.COMPOSER_ORIGIN).href : '/mail', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: oldMessage.subject })).toBeVisible()
  incoming = true
  const refreshStarted = new Promise(resolve => { holdRefresh = resolve })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await refreshStarted
  await expect(page.getByRole('heading', { name: oldMessage.subject })).toBeVisible()
  await expect(page.locator('.mailrow')).toHaveCount(1)
  holdRefresh = null
  releaseRefresh()
  await expect(page.locator('.mailrow').filter({ hasText: newMessage.subject })).toBeVisible()
  await expect(page.getByRole('heading', { name: oldMessage.subject })).toBeVisible()
})
