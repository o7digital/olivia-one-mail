import { z } from 'zod'
import { aiByMessage } from '../data/mockData.js'
import type { MailProvider } from '../providers/mailProvider.js'
import type { MailMessage } from '../types/domain.js'

const TTL_MS = 5 * 60 * 1000

const analysisSchema = z.object({
  summary: z.array(z.string()).default([]),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
  leadScore: z.number().min(0).max(100),
  sentiment: z.object({
    label: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  buyingSignals: z.array(z.string()).default([]),
  tasks: z.array(z.object({
    title: z.string(),
    dueAt: z.string().datetime().nullable(),
  })).default([]),
  opportunity: z.object({
    detected: z.boolean(),
    title: z.string(),
    estimatedValue: z.number().nullable(),
    currency: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  }),
  contactInsights: z.object({
    summary: z.string(),
    engagement: z.string(),
  }),
  suggestedReply: z.string(),
})

type Analysis = z.infer<typeof analysisSchema>

const cache = new Map<string, { expiresAt: number; value: Analysis }>()

function getMailboxKey(mailboxEmail: string, message: MailMessage) {
  return `${mailboxEmail.toLowerCase()}:${message.folder}:${message.id}`
}

function sanitizeText(value: string) {
  return value.replace(/[<>]/g, '').trim()
}

function mockAnalysis(message: MailMessage): Analysis {
  const fallback = aiByMessage[message.id] ?? aiByMessage.default
  return analysisSchema.parse({
    summary: fallback.summary,
    urgency: fallback.urgency,
    leadScore: fallback.leadScore,
    sentiment: { label: 'Neutral', confidence: 0.51 },
    buyingSignals: fallback.summary.slice(0, 2),
    tasks: fallback.tasks.map((title, index) => ({
      title,
      dueAt: new Date(Date.UTC(2026, 7, 17 + index, 16, 0, 0)).toISOString(),
    })),
    opportunity: {
      detected: true,
      title: fallback.opportunity.title,
      estimatedValue: Number(fallback.opportunity.value.replace(/[$,]/g, '')) || null,
      currency: 'USD',
      confidence: fallback.opportunity.confidence === 'High potential' ? 0.91 : 0.68,
    },
    contactInsights: {
      summary: fallback.summary.join(' '),
      engagement: 'Recent inbound conversation detected.',
    },
    suggestedReply: fallback.suggestedReply.join('\n\n'),
  })
}

async function generateOpenAICompatibleAnalysis(message: MailMessage): Promise<Analysis> {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) return mockAnalysis(message)

  const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions'
  const model = process.env.AI_MODEL || 'gpt-4o-mini'
  const prompt = [
    'Analyze the email and return only JSON matching the requested schema.',
    'Do not include markdown, HTML, or code fences.',
    `Sender: ${sanitizeText(message.sender)} <${sanitizeText(message.email)}>`,
    `Subject: ${sanitizeText(message.subject)}`,
    `Body:\n${message.body.map(sanitizeText).join('\n')}`,
  ].join('\n\n')

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an email analyst. Return strict JSON only.',
        },
        {
          role: 'user',
          content: `${prompt}

Schema:
{
  "summary": ["string"],
  "urgency": "Low|Medium|High|Critical",
  "leadScore": 0,
  "sentiment": { "label": "string", "confidence": 0 },
  "buyingSignals": ["string"],
  "tasks": [{ "title": "string", "dueAt": null }],
  "opportunity": { "detected": false, "title": "string", "estimatedValue": null, "currency": null, "confidence": 0 },
  "contactInsights": { "summary": "string", "engagement": "string" },
  "suggestedReply": "string"
}`,
        },
      ],
    }),
  })

  if (!response.ok) throw new Error(`AI provider error: ${response.status}`)
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI provider returned empty content')
  return analysisSchema.parse(JSON.parse(content))
}

function buildMailPrompt(message: MailMessage) {
  return [
    'Analyze this email for a sales and operations inbox.',
    'Return concise operational insights only.',
    `Sender: ${sanitizeText(message.sender)} <${sanitizeText(message.email)}>`,
    `Company: ${sanitizeText(message.company || 'Unknown')}`,
    `Subject: ${sanitizeText(message.subject)}`,
    'Email body:',
    ...message.body.map((line) => sanitizeText(line)),
    '',
    'Produce:',
    '- a short summary',
    '- urgency',
    '- buyer intent and signals',
    '- concrete follow-up tasks',
    '- opportunity potential if any',
    '- an editable reply draft',
  ].join('\n')
}

async function generatePythonOliviaAnalysis(message: MailMessage): Promise<Analysis> {
  const apiUrl = process.env.AI_API_URL
  if (!apiUrl) return mockAnalysis(message)

  const response = await fetch(apiUrl.replace(/\/$/, '') + '/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      clientCode: process.env.AI_CLIENT_CODE ?? 'default',
      language: 'en',
      message: buildMailPrompt(message),
      metadata: {
        clientName: 'Olivia One',
        clientIndustry: 'email productivity',
        clientKnowledge: `Mailbox message analysis for ${sanitizeText(message.email)}.`,
        pageTitle: sanitizeText(message.subject),
        pageContent: message.body.map(sanitizeText).join('\n'),
      },
      history: [],
      attachments: [],
    }),
  })

  if (!response.ok) throw new Error(`Python Olivia error: ${response.status}`)
  const payload = await response.json() as {
    reply?: string
    intent?: string
    nextAction?: string
    handoffRecommended?: boolean
  }

  const reply = sanitizeText(payload.reply ?? '')
  const intent = sanitizeText(payload.intent ?? 'faq')
  const nextAction = sanitizeText(payload.nextAction ?? 'Review and reply')
  const summary = [
    sanitizeText(message.preview || message.subject),
    nextAction,
    intent === 'lead' ? 'Lead intent detected.' : `Intent: ${intent}.`,
  ].filter(Boolean)

  return analysisSchema.parse({
    summary,
    urgency: payload.handoffRecommended ? 'High' : 'Medium',
    leadScore: intent === 'lead' || intent === 'booking' ? 78 : 55,
    sentiment: { label: 'Neutral', confidence: 0.6 },
    buyingSignals: intent === 'lead' || intent === 'booking' ? ['Commercial intent detected'] : [],
    tasks: [
      {
        title: nextAction || 'Review message',
        dueAt: null,
      },
    ],
    opportunity: {
      detected: intent === 'lead' || intent === 'booking',
      title: intent === 'lead' || intent === 'booking' ? `Opportunity from ${sanitizeText(message.sender)}` : '',
      estimatedValue: null,
      currency: null,
      confidence: intent === 'lead' || intent === 'booking' ? 0.72 : 0.35,
    },
    contactInsights: {
      summary: `Contact ${sanitizeText(message.sender)} from ${sanitizeText(message.company || message.email)} about ${sanitizeText(message.subject)}.`,
      engagement: payload.handoffRecommended ? 'Human follow-up recommended.' : 'Active inbound conversation.',
    },
    suggestedReply: reply || `Hi ${sanitizeText(message.sender).split(' ')[0] || 'there'},\n\nThank you for your message.\n\nBest regards,\n\nOlivier`,
  })
}

export async function analyzeMessage(provider: MailProvider, mailboxEmail: string, messageId: string): Promise<Analysis> {
  const message = await provider.getMessage(messageId)
  if (!message) throw new Error('Message not found')

  const cacheKey = getMailboxKey(mailboxEmail, message)
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const aiProvider = process.env.AI_PROVIDER ?? 'mock'
  const value = aiProvider === 'python-olivia'
    ? await generatePythonOliviaAnalysis(message)
    : aiProvider === 'openai'
      ? await generateOpenAICompatibleAnalysis(message)
      : mockAnalysis(message)
  cache.set(cacheKey, { value, expiresAt: Date.now() + TTL_MS })
  return value
}
