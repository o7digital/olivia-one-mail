const STORAGE_PREFIX = 'olivia-one:compose-draft:v1'

function storageKey(mailboxEmail, mode, messageId) {
  const mailbox = String(mailboxEmail || 'anonymous').trim().toLowerCase()
  const context = messageId || (mode === 'new' ? 'new-message' : mode)
  const draftMode = mode === 'reply-all' ? 'reply' : mode
  return `${STORAGE_PREFIX}:${encodeURIComponent(mailbox)}:${encodeURIComponent(draftMode)}:${encodeURIComponent(context)}`
}

function legacyStorageKey(mailboxEmail, mode, messageId) {
  const mailbox = String(mailboxEmail || 'anonymous').trim().toLowerCase()
  const context = messageId || (mode === 'new' ? 'new-message' : mode)
  return `${STORAGE_PREFIX}:${encodeURIComponent(mailbox)}:${encodeURIComponent(context)}`
}

function normalizeDraft(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  return {
    to: typeof parsed.to === 'string' ? parsed.to : '',
    cc: typeof parsed.cc === 'string' ? parsed.cc : '',
    bcc: typeof parsed.bcc === 'string' ? parsed.bcc : '',
    subject: typeof parsed.subject === 'string' ? parsed.subject : '',
    body: typeof parsed.body === 'string' ? parsed.body : '',
    html: typeof parsed.html === 'string' ? parsed.html : '',
  }
}

function matchesLegacyMode(draft, mode, messageId) {
  if (!draft) return false
  if (!messageId) return mode === 'new'

  const forwarded = draft.body.includes('---------- Forwarded message ---------') || /^Fwd:/i.test(draft.subject)
  const reply = draft.html.includes('data-quoted-content="true"') || /(?:^|\n)On .+ wrote:\s*(?:\n|$)/.test(draft.body) || /^Re:/i.test(draft.subject)
  if (mode === 'forward') return forwarded
  if (mode === 'reply' || mode === 'reply-all') return reply && !forwarded
  return false
}

export function hasDraftContent(draft) {
  return Object.values(draft).some((value) => typeof value === 'string' && value.trim())
}

export function loadComposeDraft(mailboxEmail, mode, messageId) {
  try {
    const key = storageKey(mailboxEmail, mode, messageId)
    const currentDraft = normalizeDraft(JSON.parse(window.localStorage.getItem(key) || 'null'))
    if (currentDraft) return currentDraft

    const oldKey = legacyStorageKey(mailboxEmail, mode, messageId)
    const legacyDraft = normalizeDraft(JSON.parse(window.localStorage.getItem(oldKey) || 'null'))
    if (!matchesLegacyMode(legacyDraft, mode, messageId)) return null
    window.localStorage.setItem(key, JSON.stringify(legacyDraft))
    window.localStorage.removeItem(oldKey)
    return legacyDraft
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
