function normalize(email: string) {
  return email.trim().toLowerCase()
}

function dedupeExcluding(addresses: string[], exclude: Set<string>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const address of addresses) {
    const trimmed = address.trim()
    if (!trimmed) continue
    const key = normalize(trimmed)
    if (exclude.has(key) || seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

/**
 * Reply-all recipients = original sender + original To/CC, excluding the authenticated mailbox.
 * CC semantics are preserved: original To recipients stay in "to", original CC recipients stay in "cc".
 */
export function computeReplyAllRecipients(input: {
  mailboxEmail: string
  senderEmail: string
  to?: string[]
  cc?: string[]
}): { to: string[]; cc: string[] } {
  const exclude = new Set([normalize(input.mailboxEmail)])
  const to = dedupeExcluding([input.senderEmail, ...(input.to ?? [])], exclude)
  const cc = dedupeExcluding(input.cc ?? [], new Set([...exclude, ...to.map(normalize)]))
  return { to, cc }
}
