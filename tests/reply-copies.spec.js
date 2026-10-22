import { expect, test } from '@playwright/test'

for (const mode of ['Reply', 'Reply all']) {
  test(`${mode} exposes copies, restores them and submits both`, async ({ page }) => {
    const message = { id: 'copy-test', folder: 'Inbox', sender: 'Copy Test', email: 'sender@example.com', subject: 'Copies regression', body: ['Original'], bodyText: 'Original', to: ['user@example.com'], cc: ['existing@example.com'], attachments: [], initials: 'CT', tone: 'cyan', preview: 'Original', time: '12:00', role: '', company: '', labels: [], receivedAt: '2026-10-22T10:00:00Z' }
    let sent
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.startsWith('/api/ai/')) return route.fulfill({ status: 503, json: { message: 'AI unavailable in copy-recipient test' } })
      if (path.includes('/reply')) { sent = route.request().postDataJSON(); return route.fulfill({ json: { status: 'sent' } }) }
      const json = path === '/api/me' ? { authenticated: true, user: { email: 'user@example.com', name: 'Test' } }
        : path === '/api/mail/messages' ? { messages: [message], pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 } }
        : path === '/api/mail/messages/copy-test' ? message : []
      return route.fulfill({ json })
    })
    await page.goto('/mail')
    await expect(page.getByRole('heading', { name: 'Copies regression' })).toBeVisible()
    await page.getByRole('button', { name: mode, exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'CC', exact: true }).click()
    await dialog.getByRole('button', { name: 'CCI', exact: true }).click()
    await dialog.getByLabel('Carbon copy recipients', { exact: true }).fill('copy@example.com')
    await dialog.getByLabel('Blind carbon copy recipients').fill('hidden@example.com')
    await dialog.getByLabel('Message body').fill('Reply with copies')
    await dialog.getByRole('button', { name: 'Close composer' }).click()
    await page.getByRole('button', { name: mode, exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Carbon copy recipients', { exact: true })).toHaveValue('copy@example.com')
    await expect(dialog.getByLabel('Blind carbon copy recipients')).toHaveValue('hidden@example.com')
    await dialog.getByRole('button', { name: 'Send', exact: true }).click()
    await expect.poll(() => sent).toMatchObject({ cc: 'copy@example.com', bcc: 'hidden@example.com', body: 'Reply with copies' })
  })
}
