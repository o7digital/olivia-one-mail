import { apiClient } from './apiClient'

async function sendMail(path, input) {
  const result = await apiClient.post(path, input)
  window.dispatchEvent(new Event('olivia:mail-sent'))
  return result
}

export const mailService = {
  ensureSession: () => apiClient.ensureSession(),
  listFolders: () => apiClient.get('/api/mail/folders'),
  listMessages: (folder = 'Inbox', page = 1, pageSize = 25, starredOnly = false) => apiClient.get('/api/mail/messages', { folder, page, pageSize, starred: starredOnly || undefined }),
  getMessage: (id) => apiClient.get(`/api/mail/messages/${id}`),
  getAttachmentUrl: (id, index) => `/api/mail/messages/${encodeURIComponent(id)}/attachments/${index}`,
  markRead: (id) => apiClient.post(`/api/mail/messages/${id}/read`, {}),
  toggleStar: (id) => apiClient.post(`/api/mail/messages/${id}/star`, {}),
  moveMessage: (id, folder) => apiClient.post(`/api/mail/messages/${id}/move`, { folder }),
  deleteMessage: (id) => apiClient.delete(`/api/mail/messages/${id}`),
  sendMessage: (input) => sendMail('/api/mail/send', input),
  replyToMessage: (id, body, html = '', attachments = []) => sendMail(`/api/mail/reply/${id}`, { body, html, attachments }),
  replyAllMessage: (id, body, html = '', attachments = []) => sendMail(`/api/mail/reply-all/${id}`, { body, html, attachments }),
  forwardMessage: (id, input) => sendMail(`/api/mail/forward/${id}`, input),
  listLabels: (folder = 'Inbox') => apiClient.get('/api/mail/labels', { folder }),
  setMessageLabels: (id, labels) => apiClient.put(`/api/mail/messages/${id}/labels`, { labels }),
}
