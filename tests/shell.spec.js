import { expect, test } from '@playwright/test'

test('mail shell interactions and desktop screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1080 })
  await page.goto('/mail')
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toBeVisible()

  await page.getByRole('button', { name: /Liam Chen/ }).click()
  await expect(page.getByRole('heading', { name: 'Q3 Performance Review' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Search messages' }).fill('Sophia')
  await expect(page.getByRole('button', { name: /Sophia Martinez/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Liam Chen/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear search' }).click()
  await page.getByRole('button', { name: /Sophia Martinez/ }).click()

  await page.screenshot({ path: 'artifacts/olivia-one-mail-desktop.png', fullPage: true })

  await page.getByRole('button', { name: 'Compose' }).click()
  await expect(page.getByRole('dialog', { name: 'New Message' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Recipient' }).fill('sophia@acmecorp.com')
  await page.getByRole('textbox', { name: 'Subject' }).fill('Partnership next steps')
  await page.screenshot({ path: 'artifacts/olivia-one-compose.png', fullPage: true })
  await page.getByRole('button', { name: 'Close composer' }).click()

  await page.getByRole('tab', { name: 'Insights' }).click()
  await expect(page.getByText('Conversation intelligence')).toBeVisible()
  await page.getByRole('tab', { name: 'Overview' }).click()
  await page.getByRole('button', { name: 'Create Opportunity' }).click()
  await expect(page.getByRole('dialog', { name: 'Create Partnership Expansion?' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm opportunity' }).click()
  await expect(page.getByRole('status')).toContainText('Opportunity created in O7 Pulse')
})

test('tablet layout and application routes', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/mail')
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
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
