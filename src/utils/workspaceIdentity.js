export function getWorkspaceIdentity(user) {
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : ''
  const domain = email.includes('@') ? email.split('@').at(-1) : ''
  const fallbackName = user?.name || email || 'Mailbox'

  return {
    displayName: domain || fallbackName,
    email,
    initials: (domain || fallbackName)
      .split(/[.\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase(),
    spaces: domain ? [domain, 'Product & Design', 'Sales Team', 'Marketing'] : [],
  }
}
