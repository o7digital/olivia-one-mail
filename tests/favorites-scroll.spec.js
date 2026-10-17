import { expect, test } from '@playwright/test'

async function signIn(page) {
  await page.goto('/mail')
  await page.getByRole('textbox', { name: 'Email' }).fill('scroll-test@example.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('playwright-test-password')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
}

const messages = Array.from({ length: 75 }, (_, index) => ({
  id: `scroll-${index + 1}`, folder: 'Inbox', sender: `Sender ${index + 1}`, initials: 'S',
  subject: `Subject ${index + 1}`, time: '12:00 PM', receivedAt: new Date(Date.UTC(2026, 9, 17, 12, 0, -index)).toISOString(),
  email: 'sender@example.com', company: 'Example', tone: 'cyan', category: 'focused',
  preview: 'A message to test scrolling.', body: ['Message body'], attachments: [], unread: false,
  starred: index === 69,
}))

test('scroll appends mail, retries errors and finds favorites beyond loaded pages', async ({ page }) => {
  const requested = []
  let failNextPage = true
  let releaseThirdPage
  await page.route('**/api/mail/messages?*', async (route) => {
    const url = new URL(route.request().url())
    const currentPage = Number(url.searchParams.get('page'))
    const favorites = url.searchParams.get('starred') === 'true'
    requested.push({ page: currentPage, favorites })
    if (currentPage === 2 && failNextPage) {
      failNextPage = false
      await route.fulfill({ status: 503, json: { message: 'Temporary mail failure' } })
      return
    }
    if (currentPage === 3 && !favorites) await new Promise((resolve) => { releaseThirdPage = resolve })
    const source = favorites ? messages.filter((message) => message.starred) : messages
    await route.fulfill({ json: {
      messages: source.slice((currentPage - 1) * 25, currentPage * 25),
      pagination: { page: currentPage, pageSize: 25, total: source.length, totalPages: Math.ceil(source.length / 25) },
    } })
  })
  await page.route('**/api/mail/messages/*/read', (route) => route.fulfill({ json: { unread: false } }))
  await signIn(page)
  const rows = page.getByLabel('Message list', { exact: true })
  await expect(page.locator('.mailrow')).toHaveCount(25)
  await rows.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(rows.getByRole('alert')).toContainText('Temporary mail failure')
  await expect(page.locator('.mailrow')).toHaveCount(25)
  await rows.getByRole('button', { name: 'Retry loading more messages' }).click()
  await expect(page.locator('.mailrow')).toHaveCount(50)
  await expect(page.locator('.mailrow[aria-current="true"]')).toContainText('Sender 1')
  expect(new Set(await page.locator('.mailrow').allTextContents()).size).toBe(50)

  await rows.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(rows).toHaveAttribute('aria-busy', 'true')
  await page.getByRole('button', { name: 'Filter messages', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Favorites', exact: true }).click()
  await expect(page.locator('.mailrow')).toHaveCount(1)
  await expect(page.locator('.mailrow')).toContainText('Sender 70')
  releaseThirdPage()
  await expect(rows).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.mailrow')).toHaveCount(1)
  expect(requested.some((request) => request.favorites)).toBe(true)

  await page.getByRole('button', { name: 'Clear favorites filter' }).click()
  await expect(page.locator('.mailrow')).toHaveCount(25)
  await rows.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(page.locator('.mailrow')).toHaveCount(50)
  await rows.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(rows).toHaveAttribute('aria-busy', 'true')
  releaseThirdPage()
  await expect(page.locator('.mailrow')).toHaveCount(75)
  await rows.getByText('All messages loaded', { exact: true }).scrollIntoViewIfNeeded()
  await expect(rows.getByText('All messages loaded', { exact: true })).toBeVisible()
  await expect(page.locator('.mailrow[aria-current="true"]')).toContainText('Sender 1')
})

test('removing the last favorite updates the filtered list and empty state', async ({ page }) => {
  let favorite = true
  await page.route('**/api/mail/messages?*', (route) => {
    const starredOnly = new URL(route.request().url()).searchParams.get('starred') === 'true'
    const source = starredOnly && !favorite ? [] : [{ ...messages[0], starred: favorite }]
    return route.fulfill({ json: { messages: source, pagination: { page: 1, pageSize: 25, total: source.length, totalPages: source.length ? 1 : 0 } } })
  })
  await page.route('**/api/mail/messages/*/star', (route) => {
    favorite = !favorite
    return route.fulfill({ json: { id: messages[0].id, starred: favorite } })
  })
  await signIn(page)
  await page.getByRole('button', { name: 'Filter messages', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Favorites', exact: true }).click()
  await expect(page.locator('.mailrow')).toHaveCount(1)
  await page.locator('.titleline').getByRole('button', { name: 'Remove star', exact: true }).click()
  await expect(page.locator('.mailrow')).toHaveCount(0)
  await expect(page.getByText('No favorites yet', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear favorites filter' }).click()
  await expect(page.locator('.mailrow')).toHaveCount(1)
  await expect(page.locator('.titleline').getByRole('button', { name: 'Add star' })).toBeVisible()
})
