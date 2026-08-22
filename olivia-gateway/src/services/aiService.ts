import { z } from 'zod'
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
  intent: z.string(),
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
  model: z.string().nullable().default(null),
  reasoningTier: z.string().nullable().default(null),
  toolsUsed: z.array(z.string()).default([]),
})

const draftResponseSchema = z.object({
  draft: z.string().min(1),
  model: z.string().nullable().default(null),
  reasoningTier: z.enum(['fast', 'balanced', 'powerful']).nullable().default(null),
  toolsUsed: z.array(z.string()).default([]),
})

type Analysis = z.infer<typeof analysisSchema>
type RewriteAction = 'shorter' | 'longer' | 'formal' | 'friendly' | 'translate-fr' | 'translate-es' | 'translate-en' | 'improve'

const cache = new Map<string, { expiresAt: number; value: Analysis }>()

function getMailboxKey(mailboxEmail: string, message: MailMessage) {
  return `${mailboxEmail.toLowerCase()}:${message.folder}:${message.id}`
}

function sanitizeText(value: string) {
  return value.replace(/[<>]/g, '').trim()
}

function resolveClientCode(mailboxEmail: string, env: { aiMailboxClientMap: Record<string, string>; aiDomainClientMap: Record<string, string>; aiDefaultClientCode: string }) {
  const mailbox = mailboxEmail.trim().toLowerCase()
  if (env.aiMailboxClientMap[mailbox]) return env.aiMailboxClientMap[mailbox]
  const domain = mailbox.split('@')[1] ?? ''
  if (domain && env.aiDomainClientMap[domain]) return env.aiDomainClientMap[domain]
  return env.aiDefaultClientCode
}

async function callPythonOlivia<T>(appEnv: {
  aiApiUrl: string
  oliviaInternalToken: string
}, path: string, body: unknown): Promise<T> {
  if (!appEnv.aiApiUrl || !appEnv.oliviaInternalToken) throw new Error('Olivia AI temporarily unavailable')
  const response = await fetch(appEnv.aiApiUrl.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-olivia-internal-token': appEnv.oliviaInternalToken,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('Olivia AI temporarily unavailable')
  return response.json() as Promise<T>
}

async function buildAnalyzePayload(provider: MailProvider, mailboxEmail: string, message: MailMessage, appEnv: {
  aiMailboxClientMap: Record<string, string>
  aiDomainClientMap: Record<string, string>
  aiDefaultClientCode: string
}) {
  const clientCode = resolveClientCode(mailboxEmail, appEnv)
  return {
    clientCode,
    mailbox: mailboxEmail,
    sender: message.sender,
    senderEmail: message.email,
    recipients: [mailboxEmail],
    subject: message.subject,
    body: message.body.map(sanitizeText).join('\n'),
    previousMessages: [],
    language: 'auto',
  }
}

export async function analyzeMessage(provider: MailProvider, mailboxEmail: string, messageId: string, appEnv: {
  aiProvider: string
  aiApiUrl: string
  oliviaInternalToken: string
  aiMailboxClientMap: Record<string, string>
  aiDomainClientMap: Record<string, string>
  aiDefaultClientCode: string
}): Promise<Analysis> {
  const message = await provider.getMessage(messageId)
  if (!message) throw new Error('Message not found')

  const cacheKey = getMailboxKey(mailboxEmail, message)
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  if (appEnv.aiProvider !== 'python-olivia') throw new Error('Olivia AI temporarily unavailable')
  const payload = await buildAnalyzePayload(provider, mailboxEmail, message, appEnv)
  const value = analysisSchema.parse(await callPythonOlivia(appEnv, '/email/analyze', payload))
  cache.set(cacheKey, { value, expiresAt: Date.now() + TTL_MS })
  return value
}

export async function rewriteDraft(appEnv: {
  aiApiUrl: string
  oliviaInternalToken: string
  aiMailboxClientMap: Record<string, string>
  aiDomainClientMap: Record<string, string>
  aiDefaultClientCode: string
}, input: {
  mailboxEmail: string
  action: RewriteAction
  draft: string
  recipient?: string
  subject?: string
}) {
  const clientCode = resolveClientCode(input.mailboxEmail, appEnv)
  return draftResponseSchema.parse(await callPythonOlivia(appEnv, '/email/rewrite', {
    clientCode,
    mailbox: input.mailboxEmail,
    action: input.action,
    draft: input.draft,
    recipient: input.recipient,
    subject: input.subject,
    language: 'auto',
  }))
}

export async function composeDraft(appEnv: {
  aiApiUrl: string
  oliviaInternalToken: string
  aiMailboxClientMap: Record<string, string>
  aiDomainClientMap: Record<string, string>
  aiDefaultClientCode: string
}, input: {
  mailboxEmail: string
  prompt: string
  recipient?: string
  subject?: string
  currentDraft?: string
}) {
  const clientCode = resolveClientCode(input.mailboxEmail, appEnv)
  return draftResponseSchema.parse(await callPythonOlivia(appEnv, '/email/compose', {
    clientCode,
    mailbox: input.mailboxEmail,
    prompt: input.prompt,
    recipient: input.recipient,
    subject: input.subject,
    currentDraft: input.currentDraft,
    language: 'auto',
  }))
}
