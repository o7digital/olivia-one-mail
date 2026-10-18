import { expect, test } from '@playwright/test'

test('Drive upload, quota, search, download and confirmed deletion', async ({ page }) => {
  let files = []
  let uploaded = null
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/drive/storage') return route.fulfill({ json: { storage: { used: files.length ? 2048 : 1024, limit: 10240 } } })
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
  await expect(page.locator('.driveQuota')).toContainText('1.0 KB of 10.0 KB used')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByLabel('Upload files', { exact: true }).click({ position: { x: 30, y: 16 } })
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
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

test('Drive explains an unavailable quota after file selection', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path === '/api/me' ? { authenticated: true, user: { email: 'drive@example.com' } } : path === '/api/drive/storage' ? { storage: null } : path === '/api/drive' ? { files: [], storage: null, maxFileBytes: 20971520 } : path === '/api/mail/messages' ? { messages: [], pagination: {} } : [] })
  })
  await page.goto('/drive')
  await expect(page.getByText('Storage quota unavailable')).toBeVisible()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByLabel('Upload files', { exact: true }).click({ position: { x: 30, y: 16 } })
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByRole('alert')).toContainText('Your storage quota is unavailable')
})

for (const viewport of [{ width: 1728, height: 1080 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`Drive and shared storage are discoverable from the inbox at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    let used = 80 * 1024 ** 2
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname
      const json = path === '/api/me' ? { authenticated: true, user: { email: 'drive@example.com', name: 'Drive test' } }
        : path === '/api/drive/storage' ? { storage: { used, limit: 5 * 1024 ** 3 } }
        : path === '/api/drive' ? { files: [], storage: { used, limit: 5 * 1024 ** 3 }, maxFileBytes: 20971520 }
        : path === '/api/mail/folders' ? [{ label: 'Inbox', count: 3 }, { label: 'Olivia Drive', count: 1 }, { label: 'Custom folder', count: 1 }]
        : path === '/api/mail/messages' ? { messages: [], pagination: { page: 1, total: 0, totalPages: 0 } }
        : path === '/api/mail/labels' ? { labels: [] } : []
      return route.fulfill({ json })
    })
    await page.goto('/mail')
    await expect(page.getByRole('button', { name: 'Drive', exact: true })).toBeVisible()
    if (viewport.width < 901) await page.getByRole('button', { name: 'Open navigation' }).click()
    const shortcut = page.getByRole('region', { name: 'Drive and storage' })
    await expect(shortcut).toBeInViewport()
    await expect(shortcut).toContainText('80.0 MB of 5.0 GB used')
    await expect(shortcut).toContainText('4.9 GB available')
    await expect(page.getByRole('button', { name: 'Olivia Drive', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Open Drive and storage' }).click()
    await expect(page).toHaveURL(/\/drive$/)
    await expect(page.getByRole('heading', { name: 'Drive', exact: true })).toBeVisible()
    used = 120 * 1024 ** 2
    await page.evaluate(() => window.dispatchEvent(new Event('olivia:storage-changed')))
    if (viewport.width < 901) await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(shortcut).toContainText('120.0 MB of 5.0 GB used')
    if (viewport.width < 901) await page.locator('.sidebar').getByRole('button', { name: 'Close navigation', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('quota errors in the inbox can be retried without blocking access to Drive', async ({ page }) => {
  let failed = true
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/drive/storage') return route.fulfill(failed ? { status: 503, json: { message: 'Unavailable' } } : { json: { storage: { used: 1024, limit: 10240 } } })
    return route.fulfill({ json: path === '/api/me' ? { authenticated: true, user: { email: 'drive@example.com' } } : path === '/api/mail/messages' ? { messages: [], pagination: {} } : [] })
  })
  await page.goto('/mail')
  const shortcut = page.getByRole('region', { name: 'Drive and storage' })
  await expect(shortcut).toContainText('Storage unavailable')
  failed = false
  await shortcut.getByRole('button', { name: 'Retry' }).click()
  await expect(shortcut).toContainText('1.0 KB of 10.0 KB used')
  await page.getByRole('button', { name: 'Drive', exact: true }).click()
  await expect(page).toHaveURL(/\/drive$/)
})

test('dropping files uploads their bytes and shows an active drop target', async ({ page }) => {
  let files = []
  const uploads = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/drive' && request.method() === 'POST') {
      const file = request.postDataJSON()
      uploads.push(file)
      files.push({ id: `7-${uploads.length}`, name: file.name, size: 1024, createdAt: '2026-10-17T00:00:00Z' })
      return route.fulfill({ status: 201, json: { uploaded: true } })
    }
    return route.fulfill({ json: path === '/api/me' ? { authenticated: true, user: { email: 'drop@example.com' } }
      : path === '/api/drive' ? { files, storage: { used: 1024, limit: 102400 }, maxFileBytes: 20971520 }
      : path === '/api/drive/storage' ? { storage: { used: 1024, limit: 102400 } }
      : path === '/api/mail/messages' ? { messages: [], pagination: {} } : [] })
  })
  await page.goto('/drive')
  await expect(page.getByLabel('Upload files', { exact: true })).toBeEnabled()
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['first dropped content'], 'first.txt', { type: 'text/plain' }))
    data.items.add(new File(['second dropped content'], 'second.txt', { type: 'text/plain' }))
    return data
  })
  const zone = page.getByRole('region', { name: 'File upload' })
  await zone.dispatchEvent('dragenter', { dataTransfer: transfer })
  await expect(zone).toContainText('Release to upload your files')
  await zone.dispatchEvent('dragover', { dataTransfer: transfer })
  await zone.dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByText('first.txt', { exact: true })).toBeVisible()
  await expect(page.getByText('second.txt', { exact: true })).toBeVisible()
  expect(uploads.map((file) => Buffer.from(file.contentBase64, 'base64').toString())).toEqual(['first dropped content', 'second dropped content'])
  await expect(zone).toContainText('Drop files here')
})

test('a drop with no usable quota shows a reason instead of doing nothing', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path === '/api/me' ? { authenticated: true, user: { email: 'drop@example.com' } }
      : path === '/api/drive' ? { files: [], storage: null, maxFileBytes: 20971520 }
      : path === '/api/drive/storage' ? { storage: null }
      : path === '/api/mail/messages' ? { messages: [], pagination: {} } : [] })
  })
  await page.goto('/drive')
  await expect(page.getByText('Storage quota unavailable')).toBeVisible()
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer(); data.items.add(new File(['hello'], 'hello.txt')); return data
  })
  await page.getByRole('region', { name: 'File upload' }).dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByRole('alert')).toContainText('Your storage quota is unavailable')
})

test('Upload files recovers when the page has an old unavailable quota', async ({ page }) => {
  const files = []
  let uploaded = false
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/drive' && route.request().method() === 'POST') {
      uploaded = true
      files.push({ id: '7-42', name: 'recovered.txt', size: 1024, createdAt: '2026-10-17T00:00:00Z' })
      return route.fulfill({ status: 201, json: { uploaded: true } })
    }
    return route.fulfill({ json: path === '/api/me' ? { authenticated: true, user: { email: 'picker@example.com' } }
      : path === '/api/drive/storage' ? { storage: { used: 1024, limit: 102400 } }
      : path === '/api/drive' ? { files, storage: uploaded ? { used: 2048, limit: 102400 } : null, maxFileBytes: 20971520 }
      : path === '/api/mail/messages' ? { messages: [], pagination: {} } : [] })
  })
  await page.goto('/drive')
  await expect(page.getByText('Storage quota unavailable')).toBeVisible()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByLabel('Upload files', { exact: true }).click({ position: { x: 30, y: 16 } })
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'recovered.txt', mimeType: 'text/plain', buffer: Buffer.from('recovered content') })
  await expect(page.getByText('recovered.txt', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Upload complete.')
  expect(uploaded).toBe(true)
})
