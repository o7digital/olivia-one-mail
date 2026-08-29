export interface MailAttachment {
  type: string
  title: string
  sub: string
  meta: string
  tone: string
}

export interface MailMessage {
  id: string
  folder: string
  sender: string
  initials: string
  time: string
  unread?: boolean
  starred?: boolean
  tone: string
  email: string
  role: string
  company: string
  subject: string
  preview: string
  body: string[]
  attachments: MailAttachment[]
  to?: string[]
  cc?: string[]
  labels?: string[]
  receivedAt?: string
  category?: 'focused' | 'other'
}

export interface Folder {
  label: string
  count?: number
}

export interface Contact {
  id: string
  name: string
  email: string
  company: string
  role: string
  lastContactAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  attendees: string[]
}

export interface AIAnalysis {
  messageType: 'normal_conversation' | 'commercial_inquiry' | 'pricing_request' | 'lead_opportunity' | 'invoice_payment' | 'meeting_scheduling' | 'support_request' | 'complaint' | 'contract_legal' | 'delivery_failure' | 'security_warning' | 'newsletter_low_priority' | 'automated_notification'
  recommendedActions: Array<{ type: string; label: string; confidence: number; requiresConfirmation: boolean }>
  commitments: Array<{ owner: 'user' | 'recipient'; title: string; dueAt: string | null; confidence: number }>
  deliveryFailure: null | { recipient: string | null; smtpStatus: string | null; enhancedStatusCode: string | null; remoteServer: string | null; reason: string | null; likelyCause: string | null; responsibility: 'sender' | 'recipient' | 'unknown'; severity: string }
  invoice: null | { party: string | null; amount: number | null; currency: string | null; invoiceNumber: string | null; dueDate: string | null; paymentStatus: string | null }
  scheduling: null | { proposedPeriods: string[]; attendees: string[]; location: string | null; timezone: string | null; availableSlots: Array<{ startAt: string; endAt: string }> }
  summary: string[]
  leadScore: number
  urgency: string
  sentiment: {
    label: string
    confidence: number
  }
  intent: string
  buyingSignals: string[]
  tasks: Array<{
    title: string
    dueAt: string | null
  }>
  opportunity: {
    detected: boolean
    title: string
    estimatedValue: number | null
    currency: string | null
    confidence: number
  }
  contactInsights: {
    summary: string
    engagement: string
  }
  suggestedReply: string
  model: string | null
  reasoningTier: string | null
  toolsUsed: string[]
}
