import { test, expect } from '@playwright/test'

// UI contract fixture only. This test does not claim to exercise the real V3 worker.
test('V3.5 shows classification and review-only extracted actions', async ({ page }) => {
  await page.route('**/api/ai/analyze', route => route.fulfill({ json: {
    engine: 'v3', sandbox: true, summary: ['Sandbox summary'], urgency: null,
    leadScore: null, sentiment: { label: 'Unavailable in sandbox', confidence: null }, intent: 'reservation',
    buyingSignals: [], tasks: [], extractedActions: [{ type: 'review', description: 'TODO rappeler pour la réservation' }],
    opportunity: { detected: false, title: '', confidence: 0, estimatedValue: null, currency: null },
    contactInsights: { summary: '', engagement: '' }, suggestedReply: 'Merci pour votre message.',
    classification: { category: 'reservation', confidence: 0.94 },
    recommendedActions: [], messageType: 'normal_conversation', provider: 'openai', model: 'gpt-4o', sources: [],
  } }))
  await page.goto('/mail')
  await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('fixture-password')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  const panel = page.getByLabel('AI Workspace', { exact: true })
  await expect(panel).toContainText('Olivia V3.5')
  await expect(panel).toContainText('reservation')
  await expect(panel).toContainText('Unavailable in V3 sandbox')
  await expect(panel).toContainText('TODO rappeler pour la réservation')
  await expect(panel.getByRole('button', { name: /TODO rappeler/ })).toHaveCount(0)
  await expect(panel).not.toContainText('NaN')
  await page.getByRole('button', { name: 'Reply', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Reply' })).toBeVisible()
})
