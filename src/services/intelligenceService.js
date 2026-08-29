import { apiClient } from './apiClient'

export const intelligenceService = {
  ask: (query) => apiClient.post('/api/ask', { query }),
  listFollowUps: () => apiClient.get('/api/follow-ups'),
  createFollowUp: (input) => apiClient.post('/api/follow-ups', input),
  updateFollowUp: (id, input) => apiClient.patch(`/api/follow-ups/${id}`, input),
}
