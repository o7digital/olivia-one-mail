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
