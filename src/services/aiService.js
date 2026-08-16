import { apiClient } from './apiClient'

export const aiService = {
  async getWorkspace(messageId) {
    const payload = { messageId }
    const [summary, tasks, opportunity, contact, suggestedReply] = await Promise.all([
      apiClient.post('/api/ai/summarize', payload),
      apiClient.post('/api/ai/extract-tasks', payload),
      apiClient.post('/api/ai/opportunity-score', payload),
      apiClient.post('/api/ai/contact-insights', payload),
      apiClient.post('/api/ai/suggest-reply', payload),
    ])

    return {
      summary: summary.summary,
      urgency: summary.urgency,
      leadScore: opportunity.leadScore,
      tasks: tasks.tasks,
      opportunity: opportunity.opportunity,
      contactInsights: contact,
      suggestedReply: suggestedReply.suggestedReply,
    }
  },
}
