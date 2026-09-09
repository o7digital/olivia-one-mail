import { createHash } from 'node:crypto'
import { AIError, resolveAIRoute, type AIConfig } from './aiRouting.js'
import { callV3 } from './aiV3.js'
import { z } from 'zod'
import type { MailProvider } from '../providers/mailProvider.js'
import type { MailMessage } from '../types/domain.js'

const TTL_MS = 5 * 60 * 1000

const messageTypeSchema = z.enum([
  'normal_conversation', 'commercial_inquiry', 'pricing_request', 'lead_opportunity',
  'invoice_payment', 'meeting_scheduling', 'support_request', 'complaint', 'contract_legal',
  'delivery_failure', 'security_warning', 'newsletter_low_priority', 'automated_notification',
])

const recommendedActionSchema = z.object({
  type: z.enum(['reply', 'reply_all', 'follow_up', 'create_task', 'create_event', 'add_reminder', 'upsert_contact', 'create_opportunity', 'archive', 'mark_waiting']),
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean().default(true),
})

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
  messageType: messageTypeSchema.default('normal_conversation'),
  recommendedActions: z.array(recommendedActionSchema).default([]),
  commitments: z.array(z.object({ owner: z.enum(['user', 'recipient']), title: z.string(), dueAt: z.string().datetime().nullable(), confidence: z.number().min(0).max(1) })).default([]),
  deliveryFailure: z.object({ recipient: z.string().nullable(), smtpStatus: z.string().nullable(), enhancedStatusCode: z.string().nullable(), remoteServer: z.string().nullable(), reason: z.string().nullable(), likelyCause: z.string().nullable(), responsibility: z.enum(['sender', 'recipient', 'unknown']), severity: z.enum(['low', 'medium', 'high', 'critical']) }).nullable().default(null),
  invoice: z.object({ party: z.string().nullable(), amount: z.number().nullable(), currency: z.string().nullable(), invoiceNumber: z.string().nullable(), dueDate: z.string().nullable(), paymentStatus: z.string().nullable() }).nullable().default(null),
  scheduling: z.object({ proposedPeriods: z.array(z.string()), attendees: z.array(z.string()), location: z.string().nullable(), timezone: z.string().nullable(), availableSlots: z.array(z.object({ startAt: z.string().datetime(), endAt: z.string().datetime() })) }).nullable().default(null),
})

const draftResponseSchema = z.object({
  draft: z.string().min(1),
  model: z.string().nullable().default(null),
  reasoningTier: z.enum(['fast', 'balanced', 'powerful']).nullable().default(null),
  toolsUsed: z.array(z.string()).default([]),
})

type Analysis = z.infer<typeof analysisSchema>
type RewriteAction = 'professional' | 'concise' | 'shorter' | 'longer' | 'formal' | 'friendly' | 'translate-fr' | 'translate-es' | 'translate-en' | 'improve'

const cache = new Map<string, { expiresAt: number; value: Analysis }>()

function sanitizeText(value: string) {
  return value.replace(/[<>]/g, '').trim()
}

export function normalizeContext(message: MailMessage, analysis: Analysis): Analysis {
  const text = [message.subject, message.preview, ...message.body].join('\n')
  const lower = text.toLowerCase()
  let messageType = analysis.messageType
  if (/undeliver|delivery (?:status|fail)|returned to sender|mailer-daemon|smtp error/.test(lower)) messageType = 'delivery_failure'
  else if (/invoice|facture|payment due|amount due/.test(lower)) messageType = 'invoice_payment'
  else if (/available|availability|meeting|schedule|calendrier|rendez-vous/.test(lower)) messageType = 'meeting_scheduling'
  else if (/pricing|quotation|quote|tarif|devis/.test(lower)) messageType = 'pricing_request'
  else if (/support|help|incident|bug|issue/.test(lower)) messageType = 'support_request'
  else if (/complaint|unacceptable|réclamation/.test(lower)) messageType = 'complaint'
  else if (/newsletter|unsubscribe|notification preferences/.test(lower)) messageType = 'newsletter_low_priority'
  else if (/security alert|suspicious|new sign-in|phishing/.test(lower)) messageType = 'security_warning'

  let deliveryFailure = analysis.deliveryFailure
  if (messageType === 'delivery_failure' && !deliveryFailure) {
    const status = text.match(/\b([245]\d\d)\b/)?.[1] ?? null
    const enhanced = text.match(/\b([245]\.\d\.\d{1,3})\b/)?.[1] ?? null
    const recipient = text.match(/(?:recipient|final-recipient|to):?\s*(?:rfc822;\s*)?([^\s<>]+@[^\s<>]+)/i)?.[1] ?? null
    const remoteServer = text.match(/(?:remote(?: server)?|host)\s+([^\s;]+)/i)?.[1] ?? null
    deliveryFailure = { recipient, smtpStatus: status, enhancedStatusCode: enhanced, remoteServer, reason: null, likelyCause: null, responsibility: 'unknown', severity: status?.startsWith('5') ? 'high' : 'medium' }
  }

  const defaults: Record<string, Analysis['recommendedActions']> = {
    delivery_failure: [{ type: 'create_task', label: 'Investigate delivery failure', confidence: 0.9, requiresConfirmation: true }],
    invoice_payment: [{ type: 'create_task', label: 'Review invoice and payment deadline', confidence: 0.86, requiresConfirmation: true }, { type: 'add_reminder', label: 'Remind me about this invoice', confidence: 0.82, requiresConfirmation: true }],
    meeting_scheduling: [{ type: 'reply', label: 'Draft scheduling reply', confidence: 0.9, requiresConfirmation: true }, { type: 'create_event', label: 'Review calendar event', confidence: 0.78, requiresConfirmation: true }],
    pricing_request: [{ type: 'reply', label: 'Reply with pricing', confidence: 0.9, requiresConfirmation: true }, { type: 'create_opportunity', label: 'Review opportunity in O7 Pulse', confidence: 0.78, requiresConfirmation: true }],
  }
  return { ...analysis, messageType, deliveryFailure, recommendedActions: analysis.recommendedActions.length ? analysis.recommendedActions : (defaults[messageType] ?? [{ type: 'reply', label: 'Reply', confidence: 0.7, requiresConfirmation: true }, { type: 'mark_waiting', label: 'Mark as waiting', confidence: 0.62, requiresConfirmation: true }]) }
}

async function callPythonOlivia<T>(appEnv: AIConfig, path: string, body: unknown): Promise<T> {
  if (!appEnv.aiApiUrl || !appEnv.oliviaInternalToken) throw new Error('Olivia service is unavailable')
  const response = await fetch(appEnv.aiApiUrl.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-olivia-internal-token': appEnv.oliviaInternalToken,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('Olivia service is unavailable')
  return response.json() as Promise<T>
}

async function buildAnalyzePayload(provider: MailProvider, mailboxEmail: string, message: MailMessage, appEnv: AIConfig) {
  const clientCode = resolveAIRoute(mailboxEmail, appEnv).tenant
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
    requestedContract: 'olivia-one-v3-contextual-analysis',
  }
}

export async function analyzeMessage(provider: MailProvider, mailboxEmail: string, messageId: string, appEnv: AIConfig) {
  const route = resolveAIRoute(mailboxEmail, appEnv)
  const message = await provider.getMessage(messageId)
  if (!message) throw new Error('Message not found')

  if (route.engine === 'v3') return analyzeV3(appEnv, mailboxEmail, message)
  const cacheKey = createHash('sha256').update(JSON.stringify([route, appEnv.aiApiUrl, appEnv.aiProvider, appEnv.oliviaInternalToken, message])).digest('hex')
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  if (appEnv.aiProvider !== 'python-olivia') throw new Error('Olivia service is unavailable')
  const payload = await buildAnalyzePayload(provider, mailboxEmail, message, appEnv)
  const value = normalizeContext(message, analysisSchema.parse(await callPythonOlivia(appEnv, '/email/analyze', payload)))
  cache.set(cacheKey, { value, expiresAt: Date.now() + TTL_MS })
  return value
}

export async function rewriteDraft(appEnv: AIConfig, input: {
  mailboxEmail: string
  action: RewriteAction
  draft: string
  recipient?: string
  subject?: string
}) {
  const route = resolveAIRoute(input.mailboxEmail, appEnv)
  if (route.engine === 'v3') {
    const language = input.action.startsWith('translate-') ? input.action.slice('translate-'.length) : 'auto'
    const tone = input.action === 'shorter' || input.action === 'concise'
      ? 'concise'
      : input.action === 'longer'
        ? 'detailed'
        : input.action.startsWith('translate-') || input.action === 'improve'
          ? 'professional'
          : input.action
    const result = await callV3(appEnv, input.mailboxEmail, 'rewrite', {
      text: input.draft,
      tone,
      language,
    })
    return {
      draft: result.text,
      model: result.model ?? null,
      provider: result.provider ?? null,
      reasoningTier: 'balanced' as const,
      toolsUsed: [],
      ragHits: result.rag_hits ?? 0,
      sources: result.sources ?? [],
    }
  }
  const clientCode = route.tenant
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

export async function composeDraft(appEnv: AIConfig, input: {
  mailboxEmail: string
  prompt: string
  recipient?: string
  subject?: string
  currentDraft?: string
  tone?: string
  language?: string
}) {
  const route = resolveAIRoute(input.mailboxEmail, appEnv)
  if (route.engine === 'v3') {
    const result = await callV3(appEnv, input.mailboxEmail, 'compose', {
      instruction: input.prompt,
      context: [input.recipient ? `Destinataires: ${input.recipient}` : '', input.subject ? `Objet actuel: ${input.subject}` : '', input.currentDraft ? `Brouillon actuel:\n${input.currentDraft}` : ''].filter(Boolean).join('\n'),
      tone: input.tone ?? 'professional',
      language: input.language ?? 'auto',
    })
    return {
      draft: result.body,
      subject: result.subject,
      requiresReview: true,
      model: result.model ?? null,
      provider: result.provider ?? null,
      reasoningTier: 'balanced' as const,
      toolsUsed: [],
      ragHits: result.rag_hits ?? 0,
      sources: result.sources ?? [],
    }
  }
  const clientCode = route.tenant
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

async function analyzeV3(env: AIConfig, mailbox: string, message: MailMessage) {
  const payload = buildV3EmailPayload(mailbox, message)
  const [summary, classification, reply, actions] = await Promise.all([
    callV3(env, mailbox, 'summary', payload), callV3(env, mailbox, 'classification', payload),
    callV3(env, mailbox, 'suggestedReply', payload), callV3(env, mailbox, 'actions', payload),
  ])
  return {
    engine: 'v3', sandbox: true, summary: [summary.summary], classification,
    urgency: null, unavailableFunctions: ['rewrite', 'compose', 'urgency', 'leadScore', 'sentiment', 'opportunity', 'contactInsights'],
    leadScore: null, sentiment: { label: 'Unavailable in sandbox', confidence: null },
    intent: classification.category, buyingSignals: [], tasks: [], extractedActions: actions.actions,
    opportunity: { detected: false, title: '', estimatedValue: null, currency: null, confidence: 0 },
    contactInsights: { summary: '', engagement: '' }, suggestedReply: reply.reply,
    model: summary.model ?? classification.model ?? reply.model ?? actions.model ?? null,
    reasoningTier: 'balanced', toolsUsed: [], messageType: 'normal_conversation',
    provider: summary.provider ?? classification.provider ?? reply.provider ?? actions.provider ?? null,
    ragHits: Math.max(summary.rag_hits ?? 0, classification.rag_hits ?? 0, reply.rag_hits ?? 0, actions.rag_hits ?? 0),
    sources: uniqueSources([...(summary.sources ?? []), ...(classification.sources ?? []), ...(reply.sources ?? []), ...(actions.sources ?? [])]),
    recommendedActions: [], commitments: [], deliveryFailure: null, invoice: null, scheduling: null,
  }
}

export async function suggestReply(appEnv: AIConfig, provider: MailProvider, mailboxEmail: string, messageId: string, regenerationContext = '') {
  const route = resolveAIRoute(mailboxEmail, appEnv)
  const message = await provider.getMessage(messageId)
  if (!message) throw new Error('Message not found')
  if (route.engine !== 'v3') {
    const analysis = await analyzeMessage(provider, mailboxEmail, messageId, appEnv)
    return { draft: analysis.suggestedReply, model: analysis.model, provider: 'python-olivia', ragHits: 0, sources: [] }
  }
  const result = await callV3(appEnv, mailboxEmail, 'suggestedReply', buildV3EmailPayload(mailboxEmail, message, regenerationContext))
  return {
    draft: result.reply,
    requiresReview: true,
    model: result.model ?? null,
    provider: result.provider ?? null,
    ragHits: result.rag_hits ?? 0,
    sources: result.sources ?? [],
  }
}

function buildV3EmailPayload(mailbox: string, message: MailMessage, regenerationContext = ''): Record<string, unknown> {
  return {
    subject: message.subject,
    sender: message.email,
    sender_name: message.sender,
    recipients: message.to?.length ? message.to : [mailbox],
    cc: message.cc ?? [],
    date: message.receivedAt ?? '',
    mailbox,
    body: message.body.join('\n'),
    thread_context: message.threadContext ?? '',
    regeneration_context: regenerationContext,
  }
}

function uniqueSources(sources: Array<{ kind: 'document' | 'memory'; source: string; document_id: number | null; score: number }>) {
  return Array.from(new Map(sources.map((source) => [`${source.kind}:${source.source}:${source.document_id ?? ''}`, source])).values())
}
