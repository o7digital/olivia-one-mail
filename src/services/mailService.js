import { messages } from '../mocks/mail'

const delay = (value, duration = 420) => new Promise((resolve) => {
  window.setTimeout(() => resolve(value), duration)
})

export const mockMailService = {
  async listMessages(folder = 'Inbox') {
    const matches = messages.filter((message) => message.folder === folder)
    return delay(matches)
  },

  async markRead(id) {
    return delay({ id, unread: false }, 160)
  },

  async sendMessage(input) {
    return delay({ id: `mock-${Date.now()}`, ...input, status: 'sent' }, 520)
  },
}
