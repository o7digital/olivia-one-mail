import { folders, messages } from '../data/mockData.js'
import { computeReplyAllRecipients } from '../services/mailRecipients.js'
import type { Folder, MailMessage } from '../types/domain.js'
import type { MailProvider } from './mailProvider.js'

const MOCK_MAILBOX_EMAIL = 'olivier.steineur@o7digitalgroup.com'

const state = {
  folders: structuredClone(folders),
  messages: structuredClone(messages) as MailMessage[],
}

function findMessage(id: string) {
  return state.messages.find((message) => message.id === id) ?? null
}

export class MockMailProvider implements MailProvider {
  async listFolders(): Promise<Folder[]> {
    return structuredClone(state.folders)
  }

  async listMessages(folder: string): Promise<MailMessage[]> {
    return state.messages.filter((message) => message.folder === folder)
  }

  async getMessage(id: string): Promise<MailMessage | null> {
    return findMessage(id)
  }

  async sendMessage(input: { to: string; subject: string; body: string }) {
    return { id: `sent-${Date.now()}`, status: `queued:${input.to}` }
  }

  async reply(id: string, input: { body: string }) {
    return { id: `${id}:reply`, status: `queued:${input.body.length}` }
  }

  async replyAll(id: string, input: { body: string }) {
    const original = findMessage(id)
    if (!original) throw new Error('Message not found')
    const recipients = computeReplyAllRecipients({
      mailboxEmail: MOCK_MAILBOX_EMAIL,
      senderEmail: original.email,
      to: original.to,
      cc: original.cc,
    })
    return { id: `${id}:reply-all`, status: `queued:${recipients.to.length + recipients.cc.length}:${input.body.length}` }
  }

  async forward(id: string, input: { to: string; body: string }) {
    return { id: `${id}:forward`, status: `queued:${input.to}:${input.body.length}` }
  }


  async markRead(id: string) {
    const message = findMessage(id)
    if (!message) throw new Error('Message not found')
    message.unread = false
    return { id, unread: false }
  }

  async toggleStar(id: string) {
    const message = findMessage(id)
    if (!message) throw new Error('Message not found')
    message.starred = !message.starred
    return { id, starred: Boolean(message.starred) }
  }

  async move(id: string, folder: string) {
    const message = findMessage(id)
    if (!message) throw new Error('Message not found')
    message.folder = folder
    return { id, folder }
  }

  async delete(id: string) {
    const message = findMessage(id)
    if (!message) throw new Error('Message not found')
    message.folder = 'Trash'
    return { id, deleted: true as const }
  }

  async listLabels(folder: string): Promise<string[]> {
    const set = new Set<string>()
    for (const message of state.messages) {
      if (message.folder !== folder) continue
      for (const label of message.labels ?? []) set.add(label)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }

  async setMessageLabels(id: string, labels: string[]) {
    const message = findMessage(id)
    if (!message) throw new Error('Message not found')
    const unique = Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean)))
    message.labels = unique
    return { id, labels: unique }
  }
}
