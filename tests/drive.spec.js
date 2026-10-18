import { expect, test } from '@playwright/test'

test('Drive upload, quota, search, download and confirmed deletion', async ({ page }) => {
  let files = []
  let uploaded = null
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/drive') {
      if (request.method() === 'POST') { uploaded = request.postDataJSON(); files = [{ id: '7-42', name: uploaded.name, size: 1024, createdAt: '2026-10-17T00:00:00Z' }]; return route.fulfill({ status: 201, json: { uploaded: true } }) }
      return route.fulfill({ json: { files, storage: { used: files.length ? 2048 : 1024, limit: 10240 }, maxFileBytes: 20971520 } })
    }
    if (path === '/api/drive/7-42') {
      if (request.method() === 'DELETE') { files = []; return route.fulfill({ json: { deleted: true } }) }
      return route.fulfill({ contentType: 'application/octet-stream', body: 'hello', headers: { 'content-disposition': 'attachment; filename="hello.txt"' } })
    }
    return route.fulfill({ json: path === '/api/me' ? { authenticated: true, user: { email: 'drive@example.com', name: 'Drive test' } } : path === '/api/mail/messages' ? { messages: [], pagination: { page: 1, total: 0, totalPages: 0 } } : path === '/api/mail/labels' ? { labels: [] } : [] })
  })
  await page.goto('/drive')
  await expect(page.getByRole('heading', { name: 'Drive', exact: true })).toBeVisible()
  await expect(page.getByText('1.0 KB of 10.0 KB used')).toBeVisible()
  await page.getByLabel('Choose files').setInputFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByText('hello.txt', { exact: true })).toBeVisible()
  expect(uploaded.contentBase64).toBe(Buffer.from('hello').toString('base64'))
  await page.getByLabel('Search files').fill('missing')
  await expect(page.getByText('No matching files')).toBeVisible()
  await page.getByLabel('Search files').fill('')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download hello.txt' }).click()
  expect((await download).suggestedFilename()).toBe('hello.txt')
  await page.getByRole('button', { name: 'Delete hello.txt' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.getByText('Your Drive is ready')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('Drive keeps upload disabled when shared quota cannot be verified', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path === '/api/me' ? { authenticated: true, user: { email: 'drive@example.com' } } : path === '/api/drive' ? { files: [], storage: null, maxFileBytes: 20971520 } : path === '/api/mail/messages' ? { messages: [], pagination: {} } : [] })
  })
  await page.goto('/drive')
  await expect(page.getByText('Storage quota unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload files' })).toBeDisabled()
})
