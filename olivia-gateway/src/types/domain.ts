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
  tasks: string[]
  opportunity: {
    title: string
    value: string
    confidence: string
  }
  suggestedReply: string[]
}
