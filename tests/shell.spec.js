import { expect, test } from '@playwright/test'

async function signIn(page) {
  const password = 'playwright-test-password'
  await page.goto('/mail')
  await page.getByRole('textbox', { name: 'Email' }).fill('user@zevicapital.com')
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/auth/login')),
    page.getByRole('button', { name: 'Sign in securely' }).click(),
  ])
  const responseBody = await loginResponse.text()
  expect(loginResponse.status()).toBe(200)
  expect(responseBody).not.toContain(password)
  expect(responseBody).not.toContain('OLIVIA_INTERNAL_TOKEN')
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
}

test('mail shell interactions and desktop screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1080 })
  await signIn(page)
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toBeVisible()

  await page.getByRole('button', { name: /Liam Chen/ }).click()
  await expect(page.getByRole('heading', { name: 'Q3 Performance Review' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Search messages' }).fill('Sophia')
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear search' }).click()
  await page.getByRole('button', { name: /Sophia Martinez/ }).click()

  await page.getByRole('button', { name: 'Reply', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Reply' })).toBeVisible()
  await page.getByRole('button', { name: 'Close composer' }).click()
  await page.getByRole('button', { name: 'Reply all', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Reply All' })).toBeVisible()
  await page.getByRole('button', { name: 'Close composer' }).click()
  await page.getByRole('button', { name: 'Forward', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Forward' })).toBeVisible()
  await page.getByRole('button', { name: 'Close composer' }).click()

  await page.screenshot({ path: 'artifacts/olivia-one-mail-desktop.png', fullPage: true })

  await page.getByRole('button', { name: 'Compose' }).click()
  await expect(page.getByRole('dialog', { name: 'New Message' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Recipient' }).fill('sophia@acmecorp.com')
  await page.getByRole('textbox', { name: 'Subject' }).fill('Partnership next steps')
  await page.screenshot({ path: 'artifacts/olivia-one-compose.png', fullPage: true })
  await page.getByRole('button', { name: 'Close composer' }).click()

  await expect(page.getByLabel('AI Workspace', { exact: true })).toContainText('Olivia AI temporarily unavailable')
})

test('labels can be created, filtered, and cleared; sort reorders the list', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1080 })
  await signIn(page)

  await page.getByRole('button', { name: /Sophia Martinez/ }).click()
  await expect(page.getByRole('heading', { name: 'Partnership Proposal — Next Steps' })).toBeVisible()

  await page.getByRole('button', { name: 'Add label' }).click()
  await page.getByPlaceholder('Create label…').fill('VIP Client')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.labelChip', { hasText: 'VIP Client' })).toBeVisible()

  const sidebarLabel = page.locator('.sidebar').getByRole('button', { name: 'VIP Client' })
  await expect(sidebarLabel).toBeVisible()

  await sidebarLabel.click()
  await expect(page.locator('.labelFilterBar')).toContainText('VIP Client')
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page.locator('.labelFilterBar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toBeVisible()

  await expect(page.locator('.rows .mailrow').first()).toContainText('Sophia Martinez')
  await page.getByRole('tab', { name: 'Other' }).click()
  await page.getByRole('button', { name: /Sort messages/ }).click()
  await page.getByRole('menuitemradio', { name: 'Oldest first' }).click()
  await expect(page.locator('.rows .mailrow').first()).toContainText('Noah Williams')
})

test('default classification labels remain visible and can classify a message', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: /Sophia Martinez/ }).click()

  await expect(page.locator('.sidebar').getByRole('button', { name: 'Clients' })).toBeVisible()
  await page.getByRole('button', { name: 'Add label' }).click()
  await page.locator('.labelAddPanel').getByRole('button', { name: 'Clients' }).click()
  await expect(page.locator('.labelChip', { hasText: 'Clients' })).toBeVisible()

  await page.locator('.sidebar').getByRole('button', { name: 'Clients' }).click()
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toBeVisible()
})

test('inbox category tabs filter focused and other messages', async ({ page }) => {
  await signIn(page)

  await expect(page.getByRole('tab', { name: 'Focused' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Noah Williams/ })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Other' }).click()
  await expect(page.getByRole('tab', { name: 'Other' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: /Noah Williams/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toHaveCount(0)
})

test('profile menu signs out and returns to login', async ({ page }) => {
  await signIn(page)

  await page.getByRole('button', { name: /User Zevicapital/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to your mailbox' })).toBeVisible()
})

test('account setup opens connected provider choices', async ({ page }) => {
  await signIn(page)

  await page.getByRole('button', { name: 'Setup connected accounts' }).click()
  await expect(page.getByRole('heading', { name: 'Connected accounts' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  await page.getByRole('button', { name: /iCloud/ }).click()
  await expect(page.getByRole('status')).toContainText('iCloud setup selected')
})

test('tablet layout and application routes', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await signIn(page)
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toBeVisible()
  await expect(page.getByLabel('AI Workspace', { exact: true })).toBeHidden()
  await page.screenshot({ path: 'artifacts/olivia-one-mail-tablet.png', fullPage: true })

  await page.goto('/calendar')
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
  await page.goto('/contacts')
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  await page.goto('/pulse')
  await expect(page.getByRole('heading', { name: 'Pulse' })).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})
