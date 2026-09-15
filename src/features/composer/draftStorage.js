const STORAGE_PREFIX = 'olivia-one:compose-draft:v1'

function storageKey(mailboxEmail, mode, messageId) {
  const mailbox = String(mailboxEmail || 'anonymous').trim().toLowerCase()
  const context = messageId || (mode === 'new' ? 'new-message' : mode)
  return `${STORAGE_PREFIX}:${encodeURIComponent(mailbox)}:${encodeURIComponent(context)}`
}

export function hasDraftContent(draft) {
  return Object.values(draft).some((value) => typeof value === 'string' && value.trim())
}

export function loadComposeDraft(mailboxEmail, mode, messageId) {
  try {
    const stored = window.localStorage.getItem(storageKey(mailboxEmail, mode, messageId))
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      to: typeof parsed.to === 'string' ? parsed.to : '',
      cc: typeof parsed.cc === 'string' ? parsed.cc : '',
      bcc: typeof parsed.bcc === 'string' ? parsed.bcc : '',
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      body: typeof parsed.body === 'string' ? parsed.body : '',
    }
  } catch {
    return null
  }
}

export function saveComposeDraft(mailboxEmail, mode, messageId, draft) {
  try {
    const key = storageKey(mailboxEmail, mode, messageId)
    if (hasDraftContent(draft)) window.localStorage.setItem(key, JSON.stringify(draft))
    else window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function clearComposeDraft(mailboxEmail, mode, messageId) {
  try {
    window.localStorage.removeItem(storageKey(mailboxEmail, mode, messageId))
  } catch {
    // Sending still succeeds when browser storage is unavailable.
  }
}
