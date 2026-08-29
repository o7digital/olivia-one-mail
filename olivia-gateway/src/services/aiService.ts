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
type RewriteAction = 'shorter' | 'longer' | 'formal' | 'friendly' | 'translate-fr' | 'translate-es' | 'translate-en' | 'improve'

const cache = new Map<string, { expiresAt: number; value: Analysis }>()

function getMailboxKey(mailboxEmail: string, message: MailMessage) {
  return `${mailboxEmail.toLowerCase()}:${message.folder}:${message.id}`
}

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
    requestedContract: 'olivia-one-v3-contextual-analysis',
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
  const value = normalizeContext(message, analysisSchema.parse(await callPythonOlivia(appEnv, '/email/analyze', payload)))
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
