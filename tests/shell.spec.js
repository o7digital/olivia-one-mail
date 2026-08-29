import { expect, test } from '@playwright/test'

async function signIn(page) {
  const password = 'playwright-test-password'
  await page.goto('/mail')
  await page.getByRole('textbox', { name: 'Email' }).fill('user@zevicapital.com')
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('checkbox').check()
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

test('privacy notice is available and consent is required before authentication', async ({ page }) => {
  await page.goto('/mail')
  await page.getByRole('button', { name: 'View the full privacy document' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy & data-sharing notice' })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('O7 Digital Consulting')
  await expect(page.getByRole('dialog')).toContainText('SIREN 899 748 560')
  await page.getByRole('button', { name: 'Accept and continue' }).click()
  await expect(page.getByRole('checkbox')).toBeChecked()
})

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
  await page.getByRole('button', { name: /Liam Chen/ }).click()

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

  await page.locator('.profile').click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to your mailbox' })).toBeVisible()
})

test('account setup opens connected provider choices', async ({ page }) => {
  await signIn(page)

  await page.getByRole('button', { name: 'Setup connected accounts' }).click()
  await expect(page.getByRole('heading', { name: 'Connected accounts' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  await page.getByRole('button', { name: /iCloud/ }).click()
  await expect(page.getByRole('dialog', { name: 'Add iCloud' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('olivier.steineur@icloud.com')
  await expect(page.getByRole('textbox', { name: 'App-specific password' })).toBeVisible()
})

test('tablet layout and application routes', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await signIn(page)
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toBeVisible()
  await expect(page.getByLabel('AI Workspace', { exact: true })).toBeHidden()
  await page.screenshot({ path: 'artifacts/olivia-one-mail-tablet.png', fullPage: true })

  await page.goto('/calendar')
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
  await page.getByRole('link', { name: 'Contacts' }).click()
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()
  await page.getByRole('link', { name: 'Tasks' }).click()
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  await page.getByRole('link', { name: 'O7 Pulse' }).click()
  await expect(page.getByRole('heading', { name: 'Pulse' })).toBeVisible()
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})

test('message toolbar actions update the mailbox and expose the More menu', async ({ page }) => {
  await signIn(page)

  await page.getByRole('button', { name: /Liam Chen/ }).click()
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Add star' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Add star' }).click()
  await expect(page.getByRole('status')).toContainText('Message starred')

  await page.getByRole('button', { name: 'Snooze', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Message moved to Snoozed')
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toHaveCount(0)

  await page.getByRole('button', { name: /Sophia Martinez/ }).click()
  await page.getByLabel('Message from Sophia Martinez').getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Message archived')
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Other' }).click()
  await page.getByRole('button', { name: /Ava Johnson/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Message moved to Trash')
  await expect(page.getByRole('button', { name: /Ava Johnson/ })).toHaveCount(0)
})

test('tasks can be created, completed, filtered, and deleted', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Tasks' }).click()

  await page.getByRole('textbox', { name: 'Task title' }).fill('Prepare client follow-up')
  await page.getByLabel('Due date').fill('2026-08-29')
  await page.getByLabel('Priority').selectOption('high')
  await page.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('status')).toContainText('Task created')
  await expect(page.getByText('Prepare client follow-up')).toBeVisible()

  await page.getByRole('button', { name: 'Complete Prepare client follow-up' }).click()
  await expect(page.getByRole('status')).toContainText('Task completed')
  await expect(page.getByText('Prepare client follow-up')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Completed' }).click()
  await expect(page.getByText('Prepare client follow-up')).toBeVisible()
  await page.getByRole('button', { name: 'Delete Prepare client follow-up' }).click()
  await expect(page.getByRole('status')).toContainText('Task deleted')
  await expect(page.getByText('Prepare client follow-up')).toHaveCount(0)
})

test('calendar shows a navigable month grid and event agenda', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Calendar' }).click()

  await expect(page.getByRole('grid', { name: /August 2026/ })).toBeVisible()
  await page.getByRole('gridcell', { name: /Sunday, August 16, 2 events/ }).click()
  await expect(page.getByLabel('Selected day agenda')).toContainText('Acme partnership review')
  await expect(page.getByLabel('Selected day agenda')).toContainText('Northstar performance recap')

  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(page.getByRole('grid', { name: /September 2026/ })).toBeVisible()
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('grid', { name: /August 2026/ })).toBeVisible()
})

test('Ask Olivia returns real mailbox sources and opens the matching object', async ({ page }) => {
  await signIn(page)
  await page.getByRole('textbox', { name: 'Search messages' }).fill('Noah newsletter')
  await page.getByRole('button', { name: 'Ask Olivia' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ask Olivia' })
  await expect(dialog).toContainText('matching')
  await expect(dialog).toContainText('Client Onboarding')
  await dialog.getByRole('button', { name: /Client Onboarding/ }).click()
  await expect(page.getByRole('button', { name: /Noah Williams/ })).toBeVisible()
})

test('Waiting state persists on the gateway and can be snoozed and dismissed', async ({ page }) => {
  await signIn(page)
  const subject = `Waiting E2E ${Date.now()}`
  const created = await page.evaluate(async (subject) => {
    const csrf = document.cookie.split('; ').find((value) => value.startsWith('olivia_csrf='))?.split('=')[1]
    const response = await fetch('/api/follow-ups', { method: 'POST', headers: { 'content-type': 'application/json', 'x-olivia-csrf': decodeURIComponent(csrf) }, body: JSON.stringify({ messageId: 'partnership-proposal', threadId: null, contactName: 'Sophia Martinez', contactEmail: 'sophia@acmecorp.com', subject, note: 'Waiting for revised pricing', followUpAt: new Date(Date.now() + 86400000).toISOString() }) })
    return { status: response.status, body: await response.json() }
  }, subject)
  expect(created.status).toBe(201)
  await page.getByRole('button', { name: 'Waiting' }).click()
  await expect(page.getByRole('heading', { name: 'Waiting' })).toBeVisible()
  const row = page.getByRole('article').filter({ hasText: subject })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Snooze', exact: true }).click()
  await row.getByRole('button', { name: `Dismiss ${subject}` }).click()
  await expect(row).toHaveCount(0)
})
