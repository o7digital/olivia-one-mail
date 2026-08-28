import { apiClient } from './apiClient'

export const pulseService = {
  createOpportunity: (input) => apiClient.post('/api/pulse/opportunities', input),
}
