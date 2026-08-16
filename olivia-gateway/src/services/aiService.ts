import { aiByMessage } from '../data/mockData.js'

export function getAnalysis(messageId?: string | null) {
  return aiByMessage[messageId ?? ''] ?? aiByMessage.default
}

export function buildSuggestedReply(messageId?: string | null) {
  return getAnalysis(messageId).suggestedReply.join('\n\n')
}
