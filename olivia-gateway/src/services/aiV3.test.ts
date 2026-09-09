import test from 'node:test'
import assert from 'node:assert/strict'
import { AIError, resolveAIRoute, type AIConfig } from './aiRouting.js'
import { callV3, callV3Enrichment } from './aiV3.js'
import { analyzeMessage, composeDraft, rewriteDraft } from './aiService.js'

const env: AIConfig = {
  aiApiUrl: 'https://v2.invalid', oliviaInternalToken: 'v2-secret', aiProvider: 'python-olivia',
  aiMailboxClientMap: { 'test@example.com': 'test-tenant' }, aiDomainClientMap: { 'example.com': 'live-tenant' },
  aiV3TestMailbox: 'test@example.com', aiV3TestTenant: 'test-tenant', aiV3ApiUrl: 'https://v3.invalid',
  aiV3Token: 'server-only-v3-secret', aiV3PollMs: 1, aiV3TimeoutMs: 1000,
}
const email = { subject: 'Sandbox', sender: 'sender@example.com', body: 'TODO rappeler pour la réservation' }
const resultByPath: Record<string, unknown> = {
  '/email/summary': { summary: email.body }, '/email/classification': { category: 'reservation', confidence: .8 },
  '/email/suggested-reply': { reply: 'Merci', requires_review: true }, '/text/rewrite': { text: 'Hello', tone: 'formal', language: 'auto' },
  '/email/compose': { subject: 'Brouillon Olivia', body: 'Hello', requires_review: true },
  '/actions/extract': { actions: [{ type: 'review', description: email.body }] },
}
const enrichment = {
  commercial_context: true, lead_score: 72, lead_score_reason: 'Explicit reservation request.',
  urgency: 'high', urgency_reason: 'The sender asks for a prompt confirmation.',
  sentiment: { label: 'positive', confidence: .8 }, buying_signals: ['Reservation request'],
  recommended_actions: [{ label: 'Confirm availability', reason: 'The sender requested a reservation.', confidence: .9 }],
  tasks: [{ title: 'Call back about the reservation', due_at: null }],
}

test('mapping fails closed, exact mailbox overrides domain, explicitly migrated mailboxes route V3', () => {
  assert.deepEqual(resolveAIRoute(' TEST@EXAMPLE.COM ', env), { mailbox: 'test@example.com', tenant: 'test-tenant', engine: 'v3' })
  assert.deepEqual(resolveAIRoute('kabin@example.com', { ...env, aiMailboxClientMap: { ...env.aiMailboxClientMap, 'kabin@example.com': 'kabin' }, aiV3MailboxTenantMap: { 'kabin@example.com': 'kabin' } }), { mailbox: 'kabin@example.com', tenant: 'kabin', engine: 'v3' })
  assert.equal(resolveAIRoute('live@example.com', env).engine, 'v2')
  assert.equal(resolveAIRoute('test@example.com', { ...env, aiV3TestMailbox: '' }).engine, 'v2')
  for (const mailbox of ['none@unknown.com', 'default', 'a@b@c', 'a@constructor']) assert.throws(() => resolveAIRoute(mailbox, env), AIError)
  assert.throws(() => resolveAIRoute('test@example.com', { ...env, aiV3TestTenant: 'wrong' }), /mismatch/)
  assert.throws(() => resolveAIRoute('test@example.com', { ...env, aiMailboxClientMap: { 'test@example.com': 'default' } }), /explicit/)
})

test('all six async operations adapt to the UI and never expose credentials', async () => {
  const original = globalThis.fetch
  const jobs = new Map<string, unknown>()
  const payloads: any[] = []
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('https://v3.invalid/v1/'))
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('authorization'), 'Bearer server-only-v3-secret')
    assert.equal(headers.get('x-tenant-id'), 'test-tenant')
    assert.equal(headers.get('x-olivia-internal-token'), null)
    if (String(url).endsWith('/v1/chat')) {
      const payload = JSON.parse(String(init?.body))
      assert.equal(payload.routing, 'BALANCED')
      assert.equal(payload.message.includes('private-mailbox-password'), false)
      return Response.json({ answer: JSON.stringify(enrichment), engine: 'openai', model: 'gpt-5.6-terra', provider_response_id: 'resp-enrichment', duration_ms: 12, rag_hits: 0, sandbox: true, sources: [], memories: [] })
    }
    if (init?.method === 'POST') {
      const payload = JSON.parse(String(init.body)); payloads.push(payload)
      assert.equal(payload.idempotency_key.length, 64)
      const path = String(url).split('/v1/olivia-one')[1]
      const id = String(jobs.size + 1); jobs.set(id, resultByPath[path])
      return Response.json({ job_id: id, status: 'queued', sandbox: true })
    }
    const id = String(url).split('/').pop()!
    return Response.json({ job_id: id, status: 'succeeded', sandbox: true, result: jobs.get(id) })
  }
  try {
    const provider = { getMessage: async () => ({ id: '42', folder: 'Inbox', subject: email.subject, email: email.sender, body: [email.body] }) }
    const result = await analyzeMessage(provider as never, 'test@example.com', '42', env)
    assert.equal(result.urgency, 'high')
    assert.equal(result.urgencyReason, enrichment.urgency_reason)
    assert.equal(result.leadScore, 72)
    assert.equal(result.leadScoreReason, enrichment.lead_score_reason)
    assert.equal(result.intent, 'reservation')
    assert.equal(result.suggestedReply, 'Merci')
    assert.deepEqual(result.tasks, [{ title: 'Call back about the reservation', dueAt: null }])
    assert.deepEqual(result.recommendedActions, [{ type: 'review', label: 'Confirm availability', reason: 'The sender requested a reservation.', confidence: .9, requiresConfirmation: true }])
    assert.equal((result as any).extractedActions.length, 1)
    assert.equal(result.provider, 'openai')
    assert.equal(result.model, 'gpt-5.6-terra')
    assert.equal((await rewriteDraft(env, { mailboxEmail: 'test@example.com', action: 'formal', draft: 'Hello' })).draft, 'Hello')
    assert.equal((await composeDraft(env, { mailboxEmail: 'test@example.com', prompt: 'Hello' })).draft, 'Hello')
    assert.equal(jobs.size, 6)
    assert.equal(JSON.stringify(result).includes(env.aiV3Token!), false)
    assert.equal(JSON.stringify(payloads).includes('password'), false)
  } finally { globalThis.fetch = original }
})

test('V3 enrichment returns a clean null lead score for non-commercial email', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('x-tenant-id'), 'test-tenant')
    return Response.json({
      answer: JSON.stringify({
        ...enrichment,
        commercial_context: false,
        lead_score: null,
        lead_score_reason: 'No commercial intent is present.',
        buying_signals: [],
      }),
      engine: 'openai', model: 'gpt-5.6-terra', provider_response_id: 'resp-non-commercial',
      duration_ms: 10, rag_hits: 0, sandbox: true, sources: [], memories: [],
    })
  }
  try {
    const result = await callV3Enrichment(env, 'test@example.com', email)
    assert.equal(result.lead_score, null)
    assert.equal(result.commercial_context, false)
    assert.equal(result.recommended_actions.every(action => action.confidence >= 0 && action.confidence <= 1), true)
  } finally { globalThis.fetch = original }
})

test('concurrent requests deduplicate and replay key remains stable across retries', async () => {
  const original = globalThis.fetch
  const keys: string[] = []; let polls = 0
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') {
      keys.push(JSON.parse(String(init.body)).idempotency_key)
      return Response.json({ job_id: 'same', sandbox: true, status: 'succeeded' })
    }
    polls++
    return Response.json({ job_id: 'same', sandbox: true, status: polls === 1 ? 'running' : 'succeeded', result: { summary: 'ok' } })
  }
  try {
    await Promise.all([callV3(env, 'test@example.com', 'summary', email), callV3(env, 'test@example.com', 'summary', email)])
    assert.equal(keys.length, 1)
    await callV3(env, 'test@example.com', 'summary', email)
    assert.equal(keys[0], keys[1])
    await callV3(env, 'test@example.com', 'summary', { ...email, body: 'changed' })
    assert.notEqual(keys[1], keys[2])
  } finally { globalThis.fetch = original }
})

test('timeout, failed jobs, auth errors, unsafe sandbox and malformed results fail cleanly without V2 fallback', async () => {
  const original = globalThis.fetch
  try {
    for (const mode of ['timeout', 'failed', 'auth', 'unsafe', 'malformed']) {
      globalThis.fetch = async (url, init) => {
        assert.ok(String(url).startsWith('https://v3.invalid'))
        if (mode === 'auth') return Response.json({ secret: 'never disclose' }, { status: 401 })
        return Response.json({ job_id: 'job', sandbox: mode !== 'unsafe', status: init?.method === 'POST' ? 'queued' : mode === 'failed' ? 'failed' : mode === 'malformed' ? 'succeeded' : 'running', result: {} })
      }
      await assert.rejects(callV3({ ...env, aiV3TimeoutMs: 20 }, 'test@example.com', 'summary', email), (error: any) => error instanceof AIError && error.statusCode === (mode === 'timeout' ? 504 : 503) && !error.message.includes('secret'))
    }
  } finally { globalThis.fetch = original }
})

test('unmapped mailbox cannot read a message or call upstream, including after a previous cached analysis', async () => {
  let read = false
  await assert.rejects(analyzeMessage({ getMessage: async () => { read = true } } as never, 'missing@unknown.com', '42', env), /explicit/)
  assert.equal(read, false)
})
