import { apiClient } from './apiClient'

export const pulseService = {
  syncContact: (input) => apiClient.post('/api/pulse/contacts/sync', input),
  createOpportunity: (input) => apiClient.post('/api/pulse/opportunities', input),
  createTasks: (tasks) => apiClient.post('/api/pulse/tasks', { tasks }),
  linkConversation: (input) => apiClient.post('/api/pulse/conversations/link', input),
}
