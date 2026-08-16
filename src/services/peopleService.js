import { apiClient } from './apiClient'

export const peopleService = {
  listContacts: () => apiClient.get('/api/contacts'),
  listCalendarEvents: () => apiClient.get('/api/calendar/events'),
}
