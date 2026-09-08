export class AIError extends Error {
  constructor(public code: string, public statusCode: number, message: string) { super(message) }
}

export interface AIConfig {
  aiApiUrl: string
  oliviaInternalToken: string
  aiMailboxClientMap: Record<string, string>
  aiDomainClientMap: Record<string, string>
  aiProvider?: string
  aiV3TestMailbox?: string
  aiV3TestTenant?: string
  aiV3ApiUrl?: string
  aiV3Token?: string
  aiV3ServiceEmail?: string
  aiV3ServicePassword?: string
  aiV3TestOnly?: boolean
  aiV3TimeoutMs?: number
  aiV3PollMs?: number
}

export function isV3TestMailbox(email: string, env: AIConfig) {
  return Boolean(env.aiV3TestMailbox) && email.trim().toLowerCase() === env.aiV3TestMailbox!.trim().toLowerCase()
}

export function resolveAIRoute(email: string, env: AIConfig) {
  const mailbox = email.trim().toLowerCase()
  const domain = /^[^\s@]+@([^\s@]+)$/.exec(mailbox)?.[1]
  const own = (map: Record<string, string>, key: string) => Object.hasOwn(map, key) ? map[key] : undefined
  const tenant = domain ? (own(env.aiMailboxClientMap, mailbox) ?? own(env.aiDomainClientMap, domain))?.trim() : undefined
  if (!tenant || tenant.toLowerCase() === 'default') throw new AIError('TENANT_UNMAPPED', 403, 'No explicit AI tenant mapping for this mailbox')
  const engine = isV3TestMailbox(mailbox, env) ? 'v3' : 'v2'
  if (engine === 'v3' && tenant !== env.aiV3TestTenant) throw new AIError('V3_TENANT_MISMATCH', 403, 'AI test tenant configuration mismatch')
  return { mailbox, tenant, engine }
}
