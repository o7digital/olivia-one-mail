import { apiClient } from './apiClient'

export const mailService = {
  ensureSession: () => apiClient.ensureSession(),
  listFolders: () => apiClient.get('/api/mail/folders'),
  listMessages: (folder = 'Inbox', page = 1, pageSize = 25) => apiClient.get('/api/mail/messages', { folder, page, pageSize }),
  getMessage: (id) => apiClient.get(`/api/mail/messages/${id}`),
  getAttachmentUrl: (id, filename) => `/api/mail/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(filename)}`,
  markRead: (id) => apiClient.post(`/api/mail/messages/${id}/read`, {}),
  toggleStar: (id) => apiClient.post(`/api/mail/messages/${id}/star`, {}),
  moveMessage: (id, folder) => apiClient.post(`/api/mail/messages/${id}/move`, { folder }),
  deleteMessage: (id) => apiClient.delete(`/api/mail/messages/${id}`),
  sendMessage: (input) => apiClient.post('/api/mail/send', input),
  replyToMessage: (id, body, html = '', attachments = []) => apiClient.post(`/api/mail/reply/${id}`, { body, html, attachments }),
  replyAllMessage: (id, body, html = '', attachments = []) => apiClient.post(`/api/mail/reply-all/${id}`, { body, html, attachments }),
  forwardMessage: (id, input) => apiClient.post(`/api/mail/forward/${id}`, input),
  listLabels: (folder = 'Inbox') => apiClient.get('/api/mail/labels', { folder }),
  setMessageLabels: (id, labels) => apiClient.put(`/api/mail/messages/${id}/labels`, { labels }),
}
