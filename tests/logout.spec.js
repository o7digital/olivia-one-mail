import { test, expect } from '@playwright/test'

async function signIn(page) {
  await page.goto('/mail')
  await page.getByRole('textbox', { name: 'Email' }).fill('user@zevicapital.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('playwright-test-password')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible()
}

for (const scenario of ['restored session', 'session replaced in another tab', 'encoded cookie']) {
  test(`sign out works with ${scenario}`, async ({ page, context }) => {
    await signIn(page)
    if (scenario === 'restored session') await page.reload()
    if (scenario === 'session replaced in another tab') {
      const otherTab = await context.newPage()
      await otherTab.goto('/mail')
      const response = await otherTab.request.post('/api/auth/login', { data: {
        email: 'user@zevicapital.com', password: 'playwright-test-password', privacyAccepted: true, privacyVersion: '2026-08-27',
      } })
      expect(response.ok()).toBe(true)
      await otherTab.close()
    }
    if (scenario === 'encoded cookie') {
      const cookie = (await context.cookies()).find(cookie => cookie.name === 'olivia_csrf')
      await context.addCookies([{ ...cookie, value: 'test%3Atoken' }])
      await page.reload()
    }
    await page.getByRole('button', { name: 'zevicapital.com user@zevicapital.com' }).click()
    const response = page.waitForResponse(response => response.url().endsWith('/api/auth/logout'))
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
    expect((await response).status()).toBe(200)
    await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible()
    expect((await page.request.get('/api/me')).status()).toBe(401)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible()
  })
}
