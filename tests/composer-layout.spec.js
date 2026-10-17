import { expect, test } from '@playwright/test'

test('composer keeps sending and formatting controls inside the window', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path === '/api/me'
      ? { authenticated: true, user: { email: 'layout@example.com', name: 'Layout check' } }
      : path === '/api/mail/messages'
        ? { messages: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } }
        : [] })
  })
  await page.goto(process.env.COMPOSER_ORIGIN ? new URL('/mail', process.env.COMPOSER_ORIGIN).href : '/mail')
  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New Message' })
  for (const viewport of [{ width: 1545, height: 850 }, { width: 1024, height: 650 }, { width: 390, height: 600 }]) {
    await page.setViewportSize(viewport)
    await dialog.getByRole('button', { name: 'CC', exact: true }).click()
    await dialog.getByRole('button', { name: 'CCI', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Message body' }).fill('A long email paragraph.\n'.repeat(150))
    for (const control of [dialog.getByRole('button', { name: 'Send', exact: true }), dialog.getByRole('toolbar')]) {
      await expect(control).toBeInViewport({ ratio: 1 })
      const bounds = await control.boundingBox()
      const window = await dialog.boundingBox()
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(window.y + window.height)
    }
    await dialog.getByRole('button', { name: 'Send', exact: true }).click({ trial: true })
  }
})
