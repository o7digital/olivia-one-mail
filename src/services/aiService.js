import { apiClient } from './apiClient'

export const aiService = {
  getWorkspace: (messageId) => apiClient.post('/api/ai/analyze', { messageId }),
  rewriteDraft: (input) => apiClient.post('/api/ai/rewrite', input),
  composeDraft: (input) => apiClient.post('/api/ai/compose', input),
}
