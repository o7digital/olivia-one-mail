import { chromium, expect } from '@playwright/test'

// Exercise the deployed assets with isolated browser fixtures; never read or change a real mailbox.
const origins = process.argv.slice(2)
if (!origins.length) origins.push('https://one.o7digitalgroup.com', 'https://olivia-one-mail.vercel.app')
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
try {
  for (const origin of origins) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    try {
      const page = await context.newPage()
      await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname
        const json = path === '/api/me'
          ? { authenticated: true, user: { email: 'appearance-check@example.com', name: 'Appearance check' } }
          : path === '/api/mail/messages'
            ? { messages: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } }
            : path === '/api/mail/labels' ? { labels: [] } : []
        return route.fulfill({ json })
      })
      const response = await page.goto(new URL('/settings', origin).href)
      expect(response.status()).toBe(200)
      const app = page.locator('.app')
      const slider = page.getByRole('slider', { name: 'Green color intensity' })
      await page.getByRole('button', { name: /Green/ }).click()
      await slider.scrollIntoViewIfNeeded()
      await expect(slider).toBeVisible()
      await expect(slider).toHaveValue('100')
      const originalBackground = await app.evaluate((element) => element.style.getPropertyValue('--theme-bg-start'))
      await slider.fill('120')
      await expect(slider).toHaveAttribute('aria-valuetext', '120%')
      expect(await app.evaluate((element) => element.style.getPropertyValue('--theme-bg-start'))).not.toBe(originalBackground)
      await page.reload()
      await expect(slider).toHaveValue('120')
      await slider.fill('160')
      await expect(app).toHaveAttribute('data-color-mode', 'light')
      await expect(app).toHaveCSS('--theme-bg-start', '#ffffff')
      await expect(slider).toBeVisible()
      await expect(page.getByRole('radio', { name: /Light White surfaces/ })).toBeChecked()
      await expect(page.locator('.featurePage')).toHaveCSS('background-color', 'rgb(245, 247, 250)')
      await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      for (const swatch of await page.locator('.darkPaletteGrid button > span').all()) {
        const darkestChannel = await swatch.evaluate((element) => {
          const sample = document.createElement('i')
          sample.style.backgroundColor = 'var(--palette-surface)'
          element.append(sample)
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 1
          const context = canvas.getContext('2d')
          context.fillStyle = getComputedStyle(sample).backgroundColor
          context.fillRect(0, 0, 1, 1)
          sample.remove()
          return Math.min(...context.getImageData(0, 0, 1, 1).data.slice(0, 3))
        })
        expect(darkestChannel).toBeGreaterThan(180)
      }
      await expect(page.getByText('Fresh mint.', { exact: true })).toBeVisible()
      if (process.env.APPEARANCE_SCREENSHOT) await page.screenshot({ path: process.env.APPEARANCE_SCREENSHOT })
      await page.getByRole('radio', { name: /Dark Midnight surfaces/ }).click()
      await expect(slider).toHaveValue('100')
      await expect(app).toHaveAttribute('data-color-mode', 'dark')
      await page.getByRole('link', { name: 'Mail', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Filter messages', exact: true })).toBeVisible()
      console.log(`${origin}: intensity slider visible, changes colors, persists after reload; mail filter present`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
