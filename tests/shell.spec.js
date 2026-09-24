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

test('cached inbox stays visible while startup mail refresh is slow', async ({ page }) => {
  await signIn(page)
  const firstMessage = page.locator('.mailrow').first()
  await expect(firstMessage).toBeVisible()

  await page.route('**/api/mail/messages?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800))
    await route.continue()
  })
  await page.reload()
  await expect(firstMessage).toBeVisible()
  await expect(page.getByRole('button', { name: 'Check Mail' })).toBeVisible()
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
  const replyAllComposer = page.getByRole('dialog', { name: 'Reply All' })
  await expect(replyAllComposer).toBeVisible()
  const quotedHistory = replyAllComposer.getByLabel('Original message included')
  await expect(quotedHistory).toHaveCSS('font-size', '12px')
  await expect(quotedHistory).toHaveCSS('max-height', '190px')
  await expect(quotedHistory).toContainText('Please find attached the Q3 performance review and recommendations')
  await expect(quotedHistory).not.toContainText('body, html')
  await expect(quotedHistory).not.toContainText('font-family: Roboto')
  const quotedBodyHtml = await quotedHistory.locator('.quotedMessageBody').evaluate((element) => element.innerHTML)
  expect(quotedBodyHtml).toContain('Please find attached the Q3 performance review and recommendations')
  expect(quotedBodyHtml).not.toContain('<style')
  const replyEditor = replyAllComposer.getByRole('textbox', { name: 'Message body' })
  await expect(replyEditor).toHaveCSS('color', 'rgb(244, 247, 251)')
  expect(await replyEditor.evaluate((editor) => editor.contains(document.querySelector('[data-quoted-content="true"]')))).toBe(false)
  await replyEditor.fill('This reply stays above the original message.')
  const editorBox = await replyEditor.boundingBox()
  const historyBox = await quotedHistory.boundingBox()
  expect(historyBox.y).toBeGreaterThanOrEqual(editorBox.y + editorBox.height)
  await replyAllComposer.getByRole('button', { name: 'Close composer' }).click()
  await page.getByRole('button', { name: 'Forward', exact: true }).click()
  const forwardComposer = page.getByRole('dialog', { name: 'Forward' })
  await expect(forwardComposer).toBeVisible()
  const forwardBody = forwardComposer.getByRole('textbox', { name: 'Message body' })
  await expect(forwardBody).toContainText('Forwarded message')
  await expect(forwardBody).toContainText('From: Liam Chen <liam@northstar.io>')
  await expect(forwardBody).toContainText('Date:')
  await expect(forwardBody).toContainText('Subject: Q3 Performance Review')
  await expect(forwardBody).toContainText('Please find attached the Q3 performance review and recommendations')
  const forwardedMessage = forwardComposer.getByLabel('Original message included')
  await expect(forwardedMessage).toContainText('Liam Chen <liam@northstar.io>')
  await expect(forwardedMessage).toContainText('Q3 Performance Review')
  await expect(forwardedMessage).toContainText('Please find attached the Q3 performance review and recommendations')
  await forwardComposer.getByLabel('Recipient').fill('archive@example.com')
  const forwardRequest = page.waitForRequest((request) => request.url().includes('/api/mail/forward/'))
  await forwardComposer.getByRole('button', { name: 'Send' }).click()
  const forwardPayload = JSON.parse((await forwardRequest).postData() || '{}')
  expect(forwardPayload.forwardedContentIncluded).toBe(true)
  expect(forwardPayload.body).toContain('From: Liam Chen <liam@northstar.io>')
  expect(forwardPayload.body).toContain('Please find attached the Q3 performance review and recommendations')

  await page.screenshot({ path: 'artifacts/olivia-one-mail-desktop.png', fullPage: true })

  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const composer = page.getByRole('dialog', { name: 'New Message' })
  await expect(composer).toBeVisible()
  await expect(composer).toHaveCSS('width', '1100px')
  await expect(composer).toHaveCSS('height', '820px')
  await expect(composer).toHaveCSS('resize', 'both')
  await expect(composer.getByRole('button', { name: 'Close composer' })).toBeVisible()
  await expect(composer.getByRole('button', { name: 'Minimize composer' })).toBeVisible()
  await expect(composer.getByRole('button', { name: 'Maximize composer' })).toBeVisible()
  await expect(composer.getByRole('toolbar', { name: 'Formatting options' })).toBeVisible()
  await expect(composer.getByLabel('Font family')).toBeVisible()
  await expect(composer.getByLabel('Font size')).toBeVisible()
  for (const control of ['Bold', 'Italic', 'Underline', 'Text color', 'Justify', 'Numbered list', 'Bulleted list', 'Insert link']) {
    await expect(composer.getByLabel(control, { exact: true })).toBeVisible()
  }
  const initialComposerBox = await composer.boundingBox()
  await page.mouse.move(initialComposerBox.x + initialComposerBox.width - 2, initialComposerBox.y + initialComposerBox.height - 2)
  await page.mouse.down()
  await page.mouse.move(initialComposerBox.x + initialComposerBox.width - 122, initialComposerBox.y + initialComposerBox.height - 102, { steps: 5 })
  await page.mouse.up()
  const resizedComposerBox = await composer.boundingBox()
  expect(resizedComposerBox.width).toBeLessThan(initialComposerBox.width - 80)
  expect(resizedComposerBox.height).toBeLessThan(initialComposerBox.height - 60)
  await page.getByRole('textbox', { name: 'Recipient' }).fill('sophia@acmecorp.com')
  await page.getByRole('textbox', { name: 'Subject' }).fill('Partnership next steps')
  const bodyEditor = page.getByRole('textbox', { name: 'Message body' })
  await bodyEditor.fill('Here are the next steps for our partnership.')
  await bodyEditor.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await composer.getByLabel('Font family').selectOption('Georgia')
  await composer.getByLabel('Font size').selectOption('5')
  await composer.getByLabel('Bold', { exact: true }).click()
  await composer.getByLabel('Italic', { exact: true }).click()
  await composer.getByLabel('Underline', { exact: true }).click()
  await composer.getByLabel('Justify', { exact: true }).click()
  await composer.getByLabel('Bulleted list', { exact: true }).click()
  const formattedHtml = await bodyEditor.evaluate((element) => element.innerHTML)
  expect(formattedHtml).toContain('<ul>')
  expect(formattedHtml).toMatch(/font-family:\s*Georgia/i)
  expect(formattedHtml).toMatch(/font-weight:\s*bold/i)
  expect(formattedHtml).toMatch(/font-style:\s*italic/i)
  expect(formattedHtml).toMatch(/text-decoration[^;]*underline/i)
  expect(formattedHtml).toMatch(/text-align:\s*justify/i)
  await expect(composer.getByText('Draft saved')).toBeVisible()

  await composer.getByRole('button', { name: 'Minimize composer' }).click()
  await expect(composer).toHaveClass(/is-minimized/)
  await composer.getByRole('button', { name: 'Restore composer' }).click()
  await composer.getByRole('button', { name: 'Maximize composer' }).click()
  await expect(composer).toHaveClass(/is-maximized/)
  await composer.getByRole('button', { name: 'Reduce composer' }).click()
  await composer.getByRole('button', { name: 'Close composer' }).click()

  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const restoredComposer = page.getByRole('dialog', { name: 'New Message' })
  await expect(restoredComposer.getByRole('textbox', { name: 'Recipient' })).toHaveValue('sophia@acmecorp.com')
  await expect(restoredComposer.getByRole('textbox', { name: 'Subject' })).toHaveValue('Partnership next steps')
  const restoredBody = restoredComposer.getByRole('textbox', { name: 'Message body' })
  await expect(restoredBody).toContainText('Here are the next steps for our partnership.')
  expect(await restoredBody.evaluate((element) => element.innerHTML)).toContain('<ul>')
  const fileChooserPromise = page.waitForEvent('filechooser')
  await restoredComposer.getByRole('button', { name: 'Attach files' }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles([
    { name: 'proposal.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test proposal') },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Remove this file before sending') },
  ])
  await expect(restoredComposer.getByLabel('Selected attachments')).toContainText('proposal.pdf')
  await expect(restoredComposer.getByLabel('Selected attachments')).toContainText('notes.txt')
  await restoredComposer.getByRole('button', { name: 'Remove notes.txt' }).click()
  await expect(restoredComposer.getByLabel('Selected attachments')).not.toContainText('notes.txt')
  await page.screenshot({ path: 'artifacts/olivia-one-compose.png', fullPage: true })
  const sendRequestPromise = page.waitForRequest((request) => request.url().endsWith('/api/mail/send'))
  await restoredComposer.getByRole('button', { name: 'Send', exact: true }).click()
  const sendPayload = (await sendRequestPromise).postDataJSON()
  expect(sendPayload.body).toContain('Here are the next steps')
  expect(sendPayload.html).toContain('<ul>')
  expect(sendPayload.html).toMatch(/font-weight:\s*bold/i)
  expect(sendPayload.attachments).toEqual([{
    filename: 'proposal.pdf',
    contentType: 'application/pdf',
    size: 22,
    contentBase64: Buffer.from('%PDF-1.4 test proposal').toString('base64'),
  }])
  await expect(restoredComposer).toHaveCount(0)

  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const clearedComposer = page.getByRole('dialog', { name: 'New Message' })
  await expect(clearedComposer.getByRole('textbox', { name: 'Recipient' })).toHaveValue('')
  await expect(clearedComposer.getByRole('textbox', { name: 'Subject' })).toHaveValue('')
  await expect(clearedComposer.getByRole('textbox', { name: 'Message body' })).toBeEmpty()
  await clearedComposer.getByRole('button', { name: 'Close composer' }).click()

  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const outsideClickComposer = page.getByRole('dialog', { name: 'New Message' })
  await outsideClickComposer.getByRole('textbox', { name: 'Recipient' }).fill('draft@example.com')
  await outsideClickComposer.getByRole('textbox', { name: 'Message body' }).fill('Keep this message as a draft.')
  await page.mouse.click(20, 20)
  await expect(outsideClickComposer).toHaveCount(0)
  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const outsideClickRestoredDraft = page.getByRole('dialog', { name: 'New Message' })
  await expect(outsideClickRestoredDraft.getByRole('textbox', { name: 'Recipient' })).toHaveValue('draft@example.com')
  await expect(outsideClickRestoredDraft.getByRole('textbox', { name: 'Message body' })).toContainText('Keep this message as a draft.')
  await outsideClickRestoredDraft.getByRole('button', { name: 'Close composer' }).click()

  await expect(page.getByLabel('AI Workspace', { exact: true })).toContainText('Olivia V3.5 could not analyze this email')
})

test('light theme keeps composer text readable and minimized composer restores from its full bar', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Setup connected accounts' }).click()
  await page.getByRole('radio', { name: /Light White surfaces/ }).click()
  await expect(page.locator('.app')).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const lightComposer = page.getByRole('dialog', { name: 'New Message' })
  const lightEditor = lightComposer.getByRole('textbox', { name: 'Message body' })
  await expect(lightEditor).toHaveCSS('color', 'rgb(23, 33, 43)')
  await lightEditor.evaluate((element) => {
    element.focus()
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', 'Clean pasted text.')
    clipboardData.setData('text/html', '<span style="color: black">Clean pasted text.</span>')
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
  })
  await expect(lightEditor).toContainText('Clean pasted text.')
  expect(await lightEditor.evaluate((element) => element.innerHTML)).not.toContain('color: black')
  await lightEditor.evaluate((element) => {
    element.innerHTML = '<span style="color: rgb(255, 255, 255)">Theme-aware pasted text.</span>'
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
  })
  const pastedText = lightEditor.getByText('Theme-aware pasted text.')
  await expect(pastedText).toHaveCSS('color', 'rgb(23, 33, 43)')
  await lightComposer.getByRole('button', { name: 'Minimize composer' }).click()
  await expect(lightComposer.getByRole('button', { name: 'Restore composer' })).toBeVisible()
  await lightComposer.getByRole('button', { name: 'Restore composer' }).click()
  await expect(lightComposer).toBeVisible()
  await lightComposer.getByRole('button', { name: 'Close composer' }).click()

  await page.getByRole('button', { name: 'Setup connected accounts' }).click()
  await page.getByRole('radio', { name: /Dark Midnight surfaces/ }).click()
  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const darkComposer = page.getByRole('dialog', { name: 'New Message' })
  const darkEditor = darkComposer.getByRole('textbox', { name: 'Message body' })
  await expect(darkEditor).toHaveCSS('color', 'rgb(244, 247, 251)')
  await expect(darkEditor.getByText('Theme-aware pasted text.')).toHaveCSS('color', 'rgb(244, 247, 251)')
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

test('color themes can be changed in settings and persist for the account', async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1080 })
  await signIn(page)
  await page.goto('/settings')

  const lightMode = page.getByRole('radio', { name: /Light White surfaces/ })
  const darkMode = page.getByRole('radio', { name: /Dark Midnight surfaces/ })
  await lightMode.click()
  await expect(lightMode).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.app')).toHaveAttribute('data-theme', 'light')
  await darkMode.click()
  await expect(darkMode).toHaveAttribute('aria-checked', 'true')

  for (const [name, id] of [['Olivia', 'default'], ['Green', 'green'], ['Graphite', 'gray'], ['Orange', 'orange'], ['Violet', 'violet']]) {
    const option = page.getByRole('button', { name: new RegExp(name) })
    await expect(option).toBeVisible()
    await option.click()
    await expect(option).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.app')).toHaveAttribute('data-theme', id)
  }

  const greenTheme = page.getByRole('button', { name: /Green/ })
  await greenTheme.click()
  await expect(greenTheme).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.app')).toHaveAttribute('data-theme', 'green')
  await expect(page.getByRole('status')).toContainText('Dark mode · Green palette')
  await page.screenshot({ path: 'artifacts/olivia-one-settings-themes.png', fullPage: true })

  await page.reload()
  await expect(page.locator('.app')).toHaveAttribute('data-theme', 'green')
  await expect(page.getByRole('button', { name: /Green/ })).toHaveAttribute('aria-pressed', 'true')
})

test('color intensity is stored separately for each dark palette', async ({ page }) => {
  await signIn(page)
  await page.goto('/settings')

  const app = page.locator('.app')
  const greenTheme = page.getByRole('button', { name: /Green/ })
  const orangeTheme = page.getByRole('button', { name: /Orange/ })

  await greenTheme.click()
  const greenIntensity = page.getByRole('slider', { name: 'Green color intensity' })
  await expect(greenIntensity).toHaveAttribute('min', '40')
  await expect(greenIntensity).toHaveAttribute('max', '160')
  await expect(greenIntensity).toHaveAttribute('step', '5')
  await expect(greenIntensity).toHaveValue('100')

  const originalGreenAccent = await app.evaluate((element) => element.style.getPropertyValue('--theme-accent'))
  const originalGreenBackground = await app.evaluate((element) => element.style.getPropertyValue('--theme-bg-start'))
  await greenIntensity.fill('120')
  await expect(greenIntensity).toHaveValue('120')
  await expect(greenIntensity).toHaveAttribute('aria-valuetext', '120%')
  await expect(page.getByText('120%', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Green palette')
  const adjustedGreenAccent = await app.evaluate((element) => element.style.getPropertyValue('--theme-accent'))
  const adjustedGreenBackground = await app.evaluate((element) => element.style.getPropertyValue('--theme-bg-start'))
  expect(adjustedGreenAccent).not.toBe(originalGreenAccent)
  expect(adjustedGreenBackground).not.toBe(originalGreenBackground)

  await orangeTheme.click()
  const orangeIntensity = page.getByRole('slider', { name: 'Orange color intensity' })
  await expect(app).toHaveAttribute('data-theme', 'orange')
  await expect(orangeIntensity).toHaveValue('100')
  await orangeIntensity.fill('80')
  await expect(orangeIntensity).toHaveValue('80')
  await expect(page.getByRole('status')).toContainText('Orange palette')

  await greenTheme.click()
  await expect(page.getByRole('slider', { name: 'Green color intensity' })).toHaveValue('120')
  await expect(app).toHaveAttribute('data-theme', 'green')
  await expect(app).toHaveCSS('--theme-accent', adjustedGreenAccent)

  await page.getByRole('radio', { name: /Light White surfaces/ }).click()
  await expect(app).toHaveAttribute('data-theme', 'light')
  await expect(app).toHaveCSS('--theme-bg-start', '#f8fafc')
  await expect(page.getByRole('slider')).toHaveCount(0)
  await page.getByRole('radio', { name: /Dark Midnight surfaces/ }).click()
  await expect(app).toHaveAttribute('data-theme', 'green')
  await expect(page.getByRole('slider', { name: 'Green color intensity' })).toHaveValue('120')

  await page.reload()
  await expect(app).toHaveAttribute('data-theme', 'green')
  await expect(page.getByRole('slider', { name: 'Green color intensity' })).toHaveValue('120')
  await expect(app).toHaveCSS('--theme-accent', adjustedGreenAccent)
  await orangeTheme.click()
  await expect(page.getByRole('slider', { name: 'Orange color intensity' })).toHaveValue('80')
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

  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.getByRole('grid', { name: /August 2026/ })).toBeVisible()
  await page.getByRole('gridcell', { name: /Sunday, August 16, 2 events/ }).click()
  await expect(page.getByLabel('Selected day agenda')).toContainText('Acme partnership review')
  await expect(page.getByLabel('Selected day agenda')).toContainText('Northstar performance recap')

  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(page.getByRole('grid', { name: /September 2026/ })).toBeVisible()
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('grid', { name: /September 2026/ })).toBeVisible()
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
