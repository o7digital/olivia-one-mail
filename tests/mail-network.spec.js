import { test, expect } from '@playwright/test'

test('mail loading recovers from an interrupted connection', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/mail/messages?**', route => {
    attempts += 1
    return attempts === 1 ? route.abort('failed') : route.continue()
  })
  await page.goto('/mail')
  await page.getByRole('textbox', { name: 'Email' }).fill('user@zevicapital.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('playwright-test-password')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toBeVisible()
  expect(attempts).toBe(2)
  await page.route('**/api/mail/messages?**', route => route.abort('failed'))
  await page.getByRole('button', { name: 'Check Mail', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Connection interrupted')
  await expect(page.getByRole('button', { name: 'Check Mail', exact: true })).toBeEnabled()
  await page.unroute('**/api/mail/messages?**')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toBeVisible()
})

test('a stalled mail request times out and offers retry', async ({ page }) => {
  await page.clock.install()
  await page.route('**/api/mail/messages?**', () => {})
  await page.goto('/mail')
  await page.getByRole('textbox', { name: 'Email' }).fill('user@zevicapital.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('playwright-test-password')
  await page.getByRole('checkbox').check()
  const first = page.waitForRequest('**/api/mail/messages?**')
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  await first
  const retry = page.waitForRequest('**/api/mail/messages?**')
  await page.clock.fastForward(20001)
  await retry
  await page.clock.fastForward(20001)
  await expect(page.getByRole('alert')).toContainText('Connection interrupted')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
