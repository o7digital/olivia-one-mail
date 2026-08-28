import { apiClient } from './apiClient'

export const taskService = {
  list: () => apiClient.get('/api/tasks'),
  create: (input) => apiClient.post('/api/tasks', input),
  update: (id, input) => apiClient.patch(`/api/tasks/${id}`, input),
  delete: (id) => apiClient.delete(`/api/tasks/${id}`),
}
