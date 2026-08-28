import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeMessage, composeDraft, rewriteDraft } from './aiService.js'

const provider = {
  async getMessage() {
    return {
      id: '42',
      folder: 'Inbox',
      sender: 'Jane Doe',
      initials: 'JD',
      time: '9:00 AM',
      tone: 'cyan',
      email: 'jane@example.com',
      role: '',
      company: 'Example',
      subject: 'Pricing request',
      preview: 'Can you send your proposal?',
      body: ['Can you send your proposal?', 'We need pricing this week.'],
      attachments: [],
    }
  },
} as const

test('analyzeMessage uses mailbox/domain tenant mapping and does not send mailbox password', async () => {
  const calls: Array<{ path: string; payload: unknown; headers: Headers }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    calls.push({
      path: String(input),
      payload: JSON.parse(String(init?.body ?? '{}')),
      headers: new Headers(init?.headers),
    })
    return new Response(JSON.stringify({
      summary: ['Commercial follow-up'],
      urgency: 'High',
      leadScore: 83,
      sentiment: { label: 'Positive', confidence: 0.9 },
      intent: 'lead',
      buyingSignals: ['Asked for proposal'],
      tasks: [{ title: 'Send proposal', dueAt: null }],
      opportunity: { detected: true, title: 'Proposal follow-up', estimatedValue: null, currency: null, confidence: 0.7 },
      contactInsights: { summary: 'Active deal discussion.', engagement: 'Responsive' },
      suggestedReply: 'Thank you for your email.',
      model: 'gpt-test',
      reasoningTier: 'balanced',
      toolsUsed: ['file_search'],
    }))
  }

  try {
    const env = {
      aiProvider: 'python-olivia',
      aiApiUrl: 'http://olivia-ai-python:8000',
      oliviaInternalToken: 'secret-token',
      aiMailboxClientMap: { 'sales@brand.com': 'brand-a' },
      aiDomainClientMap: { 'brand.com': 'brand-domain' },
      aiDefaultClientCode: 'default',
    }
    const analysis = await analyzeMessage(provider as never, 'sales@brand.com', '42', env)
    assert.equal(analysis.intent, 'lead')
    assert.equal(calls.length, 1)
    const first = calls[0]
    assert.match(first.path, /\/email\/analyze$/)
    assert.equal(first.headers.get('x-olivia-internal-token'), 'secret-token')
    assert.equal((first.payload as { clientCode: string }).clientCode, 'brand-a')
    assert.equal(JSON.stringify(first.payload).includes('password'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('rewriteDraft and composeDraft call internal Olivia endpoints', async () => {
  const calls: Array<{ path: string; payload: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    calls.push({
      path: String(input),
      payload: JSON.parse(String(init?.body ?? '{}')),
    })
    return new Response(JSON.stringify({
      draft: 'Updated draft',
      model: 'gpt-test',
      reasoningTier: 'fast',
      toolsUsed: [],
    }))
  }

  try {
    const env = {
      aiApiUrl: 'http://olivia-ai-python:8000',
      oliviaInternalToken: 'secret-token',
      aiMailboxClientMap: {},
      aiDomainClientMap: { 'brand.com': 'brand-domain' },
      aiDefaultClientCode: 'default',
    }
    const rewrite = await rewriteDraft(env, {
      mailboxEmail: 'ops@brand.com',
      action: 'formal',
      draft: 'hey',
      clientCode: 'other-tenant',
    } as Parameters<typeof rewriteDraft>[1])
    const compose = await composeDraft(env, { mailboxEmail: 'ops@brand.com', prompt: 'Write follow-up' })
    assert.equal(rewrite.draft, 'Updated draft')
    assert.equal(compose.draft, 'Updated draft')
    assert.match(calls[0].path, /\/email\/rewrite$/)
    assert.match(calls[1].path, /\/email\/compose$/)
    assert.equal(calls[0].payload.clientCode, 'brand-domain')
    assert.notEqual(calls[0].payload.clientCode, 'other-tenant')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Olivia calls fail closed when the internal token is missing', async () => {
  let fetchCalled = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    fetchCalled = true
    return new Response(JSON.stringify({ draft: 'Unexpected draft' }))
  }

  try {
    const env = {
      aiApiUrl: 'https://olivia-v2-python-dev-production.up.railway.app',
      oliviaInternalToken: '',
      aiMailboxClientMap: {},
      aiDomainClientMap: { 'brand.com': 'brand-domain' },
      aiDefaultClientCode: 'default',
    }
    await assert.rejects(
      rewriteDraft(env, { mailboxEmail: 'ops@brand.com', action: 'formal', draft: 'hey' }),
      /temporarily unavailable/,
    )
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
