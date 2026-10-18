import { expect, test } from '@playwright/test'
import { messages } from '../src/mocks/mail.js'
import { aiByMessage } from '../olivia-gateway/src/data/mockData.ts'

for (const theme of ['gray', 'light', 'default', 'green', 'orange', 'violet']) {
  test(`${theme} uses flat neutral surfaces across settings, mail, Drive and composer`, async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 1080 })
    await page.addInitScript((theme) => localStorage.setItem('olivia-one-color-theme:neutral@example.com', theme), theme)
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname
      const json = path === '/api/me' ? { authenticated: true, user: { email: 'neutral@example.com', name: 'Olivia One' } }
        : path === '/api/mail/messages' ? { messages: messages.filter((message) => message.folder === 'Inbox'), pagination: { page: 1, pageSize: 25, total: 5, totalPages: 1 } }
        : path.startsWith('/api/mail/messages/') ? messages.find((message) => message.id === path.split('/')[4]) || messages[0]
        : path === '/api/mail/folders' ? ['Inbox', 'Sent', 'Drafts', 'Trash', 'Archive', 'Spam'].map((label) => ({ label, count: label === 'Inbox' ? 12 : 0 }))
        : path === '/api/mail/labels' ? { labels: [] }
        : path === '/api/ai/analyze' ? aiByMessage['partnership-proposal']
        : path === '/api/drive/storage' ? { storage: { used: 84 * 1024 ** 2, limit: 5 * 1024 ** 3 } }
        : path === '/api/drive' ? { files: [], storage: { used: 84 * 1024 ** 2, limit: 5 * 1024 ** 3 }, maxFileBytes: 20971520 }
        : {}
      return route.fulfill({ json })
    })
    const background = theme !== 'light' ? 'rgb(33, 33, 33)' : 'rgb(255, 255, 255)'
    const foreground = theme !== 'light' ? 'rgb(236, 236, 236)' : 'rgb(23, 23, 23)'
    await page.goto('/settings')
    await expect(page.locator('.app')).toHaveAttribute('data-theme', theme)
    await expect(page.locator('.app')).toHaveCSS('background-image', 'none')
    await expect(page.locator('.featurePage')).toHaveCSS('background-color', background)
    await expect(page.locator('.appearanceSettings')).toHaveCSS('background-image', 'none')
    await expect(page.locator('.featureHero h1')).toHaveCSS('color', foreground)
    await expect(page.locator('.sidebar')).toHaveCSS('background-color', theme !== 'light' ? 'rgb(23, 23, 23)' : 'rgb(249, 249, 249)')
    if (theme !== 'gray' && theme !== 'light') {
      const accents = { default: 'rgb(57, 217, 255)', green: 'rgb(89, 229, 155)', orange: 'rgb(255, 180, 84)', violet: 'rgb(182, 156, 255)' }
      await expect(page.locator('.featureIcon')).toHaveCSS('color', accents[theme])
      await expect(page.locator('.storageShortcutIcon')).toHaveCSS('color', accents[theme])
    }
    await page.screenshot({ path: test.info().outputPath(`${theme}-settings.png`) })
    await page.goto('/mail')
    await expect(page.locator('.reader')).toHaveCSS('background-color', background)
    await expect(page.locator('.compose')).toHaveCSS('color', theme !== 'light' ? 'rgb(23, 23, 23)' : 'rgb(255, 255, 255)')
    await page.screenshot({ path: test.info().outputPath(`${theme}-mail.png`) })
    await page.getByRole('button', { name: 'Compose', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Message body' })).toHaveCSS('color', foreground)
    await page.getByRole('button', { name: 'Close composer' }).click()
    await page.goto('/drive')
    await expect(page.locator('.drivePage')).toHaveCSS('background-color', background)
    await expect(page.locator('.driveQuota')).toHaveCSS('background-image', 'none')
    await expect(page.getByLabel('Upload files', { exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.reload()
    await expect(page.locator('.app')).toHaveAttribute('data-theme', theme)
  })
}
