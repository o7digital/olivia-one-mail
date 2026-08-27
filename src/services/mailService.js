import { apiClient } from './apiClient'

export const mailService = {
  ensureSession: () => apiClient.ensureSession(),
  listFolders: () => apiClient.get('/api/mail/folders'),
  listMessages: (folder = 'Inbox') => apiClient.get('/api/mail/messages', { folder }),
  getMessage: (id) => apiClient.get(`/api/mail/messages/${id}`),
  markRead: (id) => apiClient.post(`/api/mail/messages/${id}/read`, {}),
  toggleStar: (id) => apiClient.post(`/api/mail/messages/${id}/star`, {}),
  moveMessage: (id, folder) => apiClient.post(`/api/mail/messages/${id}/move`, { folder }),
  deleteMessage: (id) => apiClient.delete(`/api/mail/messages/${id}`),
  sendMessage: (input) => apiClient.post('/api/mail/send', input),
  replyToMessage: (id, body) => apiClient.post(`/api/mail/reply/${id}`, { body }),
  replyAllMessage: (id, body) => apiClient.post(`/api/mail/reply-all/${id}`, { body }),
  forwardMessage: (id, input) => apiClient.post(`/api/mail/forward/${id}`, input),
  listLabels: (folder = 'Inbox') => apiClient.get('/api/mail/labels', { folder }),
  setMessageLabels: (id, labels) => apiClient.put(`/api/mail/messages/${id}/labels`, { labels }),
}
