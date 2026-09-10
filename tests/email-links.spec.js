import { expect, test } from '@playwright/test'

test('email links open a separate tab while email scripts remain blocked', async ({ page, context }) => {
  const bodyHtml = `<p><a href="https://example.com/activate?token=test" target="_top">Activate account</a></p><a href="javascript:alert(1)">Unsafe link</a><script>window.emailScriptRan = true</script>`
  await page.route('**/api/mail/messages**', async route => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    let data = await response.json()
    if (Array.isArray(data)) data = data.map(message => ({ ...message, bodyHtml }))
    if (Array.isArray(data.messages)) data.messages = data.messages.map(message => ({ ...message, bodyHtml }))
    else if (data.id) data.bodyHtml = bodyHtml
    await route.fulfill({ response, json: data })
  })
  await context.route('https://example.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Destination</h1>' }))
  await page.goto('/mail')
  await page.getByRole('textbox', { name: 'Email' }).fill('user@zevicapital.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('playwright-test-password')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  const frame = page.frameLocator('.messageHtml')
  await expect(frame.getByRole('link', { name: 'Activate account' })).toBeVisible()
  await expect(frame.getByText('Unsafe link')).not.toHaveAttribute('href')
  expect(await page.locator('.messageHtml').evaluate(el => el.sandbox.contains('allow-scripts'))).toBe(false)
  const popupPromise = context.waitForEvent('page')
  await frame.getByRole('link', { name: 'Activate account' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL('https://example.com/activate?token=test')
  await expect(popup.getByRole('heading', { name: 'Destination' })).toBeVisible()
  expect(await popup.evaluate(() => window.opener === null)).toBe(true)
  await expect(page).toHaveURL(/\/mail$/)
  const emailFrame = await (await page.locator('.messageHtml').elementHandle()).contentFrame()
  expect(await emailFrame.evaluate(() => window.emailScriptRan)).toBeUndefined()
})
