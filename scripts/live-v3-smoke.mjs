// Run in the test gateway container, from /app. Uses synthetic content, real V3 HTTP/jobs.
// Does not authenticate or read the real mailbox, nor call SMTP or any external tool.
import assert from 'node:assert/strict'
import { getEnv } from '/app/dist/config/env.js'
import { analyzeMessage, rewriteDraft, composeDraft } from '/app/dist/services/aiService.js'
import { resolveAIRoute } from '/app/dist/services/aiRouting.js'
import { getV3Token } from '/app/dist/services/aiV3Auth.js'
const env = getEnv()
const mailbox = 'info@o7digitalgroup.com'
assert.equal(env.aiV3TestOnly, process.env.EXPECT_TEST_ONLY === 'true')
assert.deepEqual(resolveAIRoute(mailbox, env), { mailbox, tenant: 'o7-internal-test', engine: 'v3' })
for (const email of ['other@o7digitalgroup.com', 'unknown@example.com']) {
  assert.throws(() => resolveAIRoute(email, env), e => e.code === 'TENANT_UNMAPPED')
}
assert.equal(resolveAIRoute('client@zevicapital.com', env).engine, 'v2')
const run = process.env.TEST_RUN_ID || new Date().toISOString()
const message = { id: run, subject: `Olivia internal acceptance ${run}`, email: mailbox, sender: 'Internal test', body: ['Bonjour, demande de réservation pour un test interne.', 'TODO rappeler pour confirmer les disponibilités.', 'Aucun envoi, aucune action externe.'] }
const provider = { getMessage: async () => message }
const started = Date.now()
const result = await analyzeMessage(provider, mailbox, run, env)
assert.equal(result.engine, 'v3')
assert.equal(result.classification.category, 'reservation')
assert.ok(result.extractedActions.length >= 1)
assert.deepEqual(result.toolsUsed, [])
assert.deepEqual(result.tasks, [])
assert.ok(result.suggestedReply)
console.log(JSON.stringify({ event: 'live.acceptance', run, mailbox, tenant: env.aiV3TestTenant, duration_ms: Date.now() - started, synthetic_input: true, result }))
const replayStart = Date.now()
assert.deepEqual(await analyzeMessage(provider, mailbox, run, env), result)
console.log(JSON.stringify({ event: 'live.replay', duration_ms: Date.now() - replayStart }))
const rewrite = await rewriteDraft(env, { mailboxEmail: mailbox, draft: 'salut, peux tu confirmer demain', action: 'professional' })
assert.ok(rewrite.draft.length > 10)
const compose = await composeDraft(env, { mailboxEmail: mailbox, prompt: 'Composer une confirmation de rendez-vous demain à 10h.', recipient: 'client@example.com' })
assert.ok(compose.draft.length > 20)
assert.ok(compose.subject)
console.log(JSON.stringify({ event: 'live.generation', rewrite_length: rewrite.draft.length, compose_length: compose.draft.length, compose_subject: compose.subject, provider: compose.provider, model: compose.model }))
const token = await getV3Token(env, env.aiV3TestTenant, AbortSignal.timeout(5000))
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
assert.equal(claims.tenant_id, env.aiV3TestTenant)
assert.equal(claims.role, 'service')
for (const tenant of [env.aiV3TestTenant, 'o7-cross-tenant-denied']) {
  const response = await fetch(env.aiV3ApiUrl + '/v1/auth/me', { headers: { authorization: `Bearer ${token}`, 'x-tenant-id': tenant } })
  assert.equal(response.status, tenant === env.aiV3TestTenant ? 200 : 403)
  console.log(JSON.stringify({ event: 'live.tenant_auth', tenant, status: response.status, role: claims.role }))
}
console.log(JSON.stringify({ event: 'live.safety', rewrite: 'review_required', compose: 'review_required', external_tools: 0, email_sent: 0, v2_called: 0 }))
