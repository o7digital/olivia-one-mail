import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const url = process.env.CHAT_URL || 'https://one.o7digitalgroup.com'
const email = process.env.CHAT_TEST_EMAIL
const password = process.env.CHAT_TEST_PASSWORD
const targetRow = Number(process.env.CHAT_TEST_ROW ?? 1)
const requireDecisionOutput = process.env.REQUIRE_DECISION_OUTPUT === 'true'
if (!email || !password) throw new Error('Browser test credentials are required')

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1728, height: 1080 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await context.newPage()
let sendRequests = 0
let externalActionRequests = 0
page.on('request', request => {
  if (/\/api\/mail\/(?:send|reply|reply-all|forward)/.test(new URL(request.url()).pathname)) sendRequests++
  if (/\/api\/(?:tasks|follow-ups|pulse\/opportunities)/.test(new URL(request.url()).pathname) && request.method() !== 'GET') externalActionRequests++
})

async function login() {
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('checkbox').check()
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/auth/login'))
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  const response = await responsePromise
  assert.equal(response.status(), 200)
  await page.getByRole('heading', { name: 'Inbox' }).waitFor({ timeout: 30000 })
  return response.status()
}

try {
  await page.goto(url + '/mail', { waitUntil: 'networkidle', timeout: 30000 })
  const firstLoginStatus = await login()
  const session = await page.evaluate(() => fetch('/api/me').then(response => response.json()))
  assert.equal(session.user.email.toLowerCase(), email.toLowerCase())
  assert.equal(session.user.v3Pilot, true)

  const folderResult = await page.evaluate(() => fetch('/api/mail/folders').then(async response => ({ status: response.status, body: await response.json() })))
  assert.equal(folderResult.status, 200)
  for (const folder of ['Inbox', 'Sent', 'Drafts', 'Trash']) assert.ok(folderResult.body.some(item => item.label === folder), `Missing real folder ${folder}`)

  const rows = page.locator('.rows .mailrow')
  await rows.first().waitFor({ timeout: 30000 })
  const rowCount = await rows.count()
  const target = rows.nth(Math.min(Math.max(0, targetRow), rowCount - 1))
  const analyzeStarted = Date.now()
  const analyzePromise = page.waitForResponse(response => response.url().endsWith('/api/ai/analyze') && response.request().method() === 'POST', { timeout: 120000 })
  await target.click()
  const analyzeResponse = await analyzePromise
  const analyzeMs = Date.now() - analyzeStarted
  const analysis = await analyzeResponse.json()
  assert.equal(analyzeResponse.status(), 200)
  assert.equal(analysis.engine, 'v3')
  assert.equal(analysis.provider, 'openai')
  assert.ok(analysis.model)
  assert.ok(analysis.summary?.[0])
  assert.ok(analysis.classification?.category)
  assert.ok(Number.isFinite(analysis.classification?.confidence))
  assert.ok(analysis.suggestedReply?.length > 20)
  assert.ok(Array.isArray(analysis.extractedActions))
  assert.ok(['low', 'medium', 'high', 'critical'].includes(analysis.urgency))
  assert.ok(analysis.urgencyReason?.length > 0)
  assert.ok(analysis.leadScore === null || (Number.isInteger(analysis.leadScore) && analysis.leadScore >= 0 && analysis.leadScore <= 100))
  assert.ok(analysis.leadScoreReason?.length > 0)
  assert.ok(Array.isArray(analysis.recommendedActions))
  assert.ok(analysis.recommendedActions.every(action => action.type === 'review' && action.requiresConfirmation === true))
  assert.ok(Array.isArray(analysis.tasks))
  assert.ok(analysis.tasks.every(task => task.title && (task.dueAt === null || !Number.isNaN(Date.parse(task.dueAt)))))
  if (requireDecisionOutput) assert.ok(
    analysis.recommendedActions.length > 0 && analysis.tasks.length > 0,
    `Expected positive decision support, got actions=${analysis.recommendedActions.length} tasks=${analysis.tasks.length}`,
  )
  const workspaceText = await page.getByLabel('AI Workspace', { exact: true }).innerText()
  assert.equal(workspaceText.includes('Unavailable in V3 sandbox'), false)
  assert.equal(workspaceText.includes('Lead Score\nUnavailable'), false)
  const reviewAction = page.locator('.recommendedActions button').first()
  if (await reviewAction.count()) {
    await reviewAction.click()
    await page.locator('.toast').filter({ hasText: 'Sandbox: no action was executed' }).waitFor()
  }
  assert.equal(externalActionRequests, 0)

  const reply = page.getByRole('textbox', { name: 'Reply draft' })
  await reply.waitFor()
  const initialReply = await reply.inputValue()
  await page.getByRole('button', { name: 'Copy reply' }).click()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), initialReply)

  const rewriteStarted = Date.now()
  const rewritePromise = page.waitForResponse(response => response.url().endsWith('/api/ai/rewrite'), { timeout: 120000 })
  await page.getByRole('button', { name: 'Professional' }).click()
  const rewriteResponse = await rewritePromise
  const rewriteMs = Date.now() - rewriteStarted
  const rewrite = await rewriteResponse.json()
  assert.equal(rewriteResponse.status(), 200)
  assert.ok(rewrite.draft?.length > 10)

  const regenerateStarted = Date.now()
  const regeneratePromise = page.waitForResponse(response => response.url().endsWith('/api/ai/suggested-reply'), { timeout: 120000 })
  await page.getByRole('button', { name: 'Regenerate' }).click()
  const regenerateResponse = await regeneratePromise
  const regenerateMs = Date.now() - regenerateStarted
  assert.equal(regenerateResponse.status(), 200)
  assert.ok((await regenerateResponse.json()).draft?.length > 20)

  await page.getByRole('button', { name: 'Insert in compose' }).click()
  const replyDialog = page.getByRole('dialog', { name: 'Reply' })
  await replyDialog.waitFor()
  assert.ok((await replyDialog.getByRole('textbox', { name: 'Message body' }).inputValue()).length > 20)
  assert.equal(await replyDialog.getByRole('button', { name: 'Send', exact: true }).isDisabled(), false)
  await replyDialog.getByRole('button', { name: 'Close composer' }).click()

  await page.getByRole('button', { name: 'Compose', exact: true }).click()
  const composeDialog = page.getByRole('dialog', { name: 'New Message' })
  await composeDialog.getByRole('textbox', { name: 'Recipient' }).fill(email)
  await composeDialog.getByRole('textbox', { name: 'Subject' }).fill('Préparation pilote Olivia One')
  await composeDialog.getByRole('textbox', { name: 'Message body' }).fill('Rédige une courte confirmation professionnelle pour un rendez-vous demain à 10h. Ne pas envoyer.')
  const composeStarted = Date.now()
  const composePromise = page.waitForResponse(response => response.url().endsWith('/api/ai/compose'), { timeout: 120000 })
  await composeDialog.getByRole('button', { name: 'Write with Olivia' }).click()
  const composeResponse = await composePromise
  const composeMs = Date.now() - composeStarted
  const compose = await composeResponse.json()
  assert.equal(composeResponse.status(), 200)
  assert.ok(compose.draft?.length > 20)
  assert.ok(compose.subject)
  assert.equal(await composeDialog.getByRole('button', { name: 'Send', exact: true }).isDisabled(), false)
  await composeDialog.getByRole('button', { name: 'Close composer' }).click()
  assert.equal(sendRequests, 0)

  const browserState = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage, cookies: document.cookie }))
  assert.equal(/AI_V3|access_token|service_password|authorization|mailbox-password/i.test(browserState), false)
  assert.equal(browserState.includes(password), false)

  await page.locator('.profile').click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.getByRole('heading', { name: 'Sign in to your mailbox' }).waitFor()
  const reconnectStatus = await login()
  assert.equal(sendRequests, 0)

  console.log(JSON.stringify({
    firstLoginStatus, reconnectStatus, mailbox: email, tenant: session.user.v3Pilot ? 'server-resolved-v3' : 'unexpected',
    folders: folderResult.body.map(item => item.label), inboxRows: await rows.count(),
    summarize: true, analyze: true, suggestedReply: true, actions: true, rewrite: true, compose: true,
    provider: analysis.provider, model: analysis.model, mailModel: analysis.mailModel, ragHits: analysis.ragHits,
    leadScore: analysis.leadScore, urgency: analysis.urgency,
    recommendedActions: analysis.recommendedActions.length, extractedTasks: analysis.tasks.length,
    analyzeMs, rewriteMs, regenerateMs, composeMs, emailSent: 0, externalActions: externalActionRequests, browserSecrets: false,
  }))
} finally {
  await browser.close()
}
