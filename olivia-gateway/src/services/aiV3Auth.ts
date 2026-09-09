import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AIError, type AIConfig } from './aiRouting.js'

const tokens = new Map<string, { token: string; expires: number }>()
const pending = new Map<string, Promise<string>>()

export async function getV3Token(env: AIConfig, tenant: string, signal: AbortSignal) {
  if (env.aiV3Token) return env.aiV3Token
  const mappedCredentials = env.aiV3ServiceCredentialsMap?.[tenant]
  const email = mappedCredentials?.email ?? env.aiV3ServiceEmail
  const password = mappedCredentials?.password ?? env.aiV3ServicePassword
  if (!email || !password) throw new AIError('V3_AUTH_UNAVAILABLE', 503, 'Olivia V3 service credentials unavailable')
  const key = createHash('sha256').update(JSON.stringify([env.aiV3ApiUrl, tenant, email, password])).digest('hex')
  const cached = tokens.get(key)
  if (cached && cached.expires > Date.now()) return cached.token
  const ongoing = pending.get(key)
  if (ongoing) return ongoing
  const task = (async () => {
    const response = await fetch(env.aiV3ApiUrl!.replace(/\/$/, '') + '/v1/auth/login', {
      method: 'POST', signal, redirect: 'error',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenant },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) throw new AIError('V3_AUTH_FAILED', 503, 'Olivia V3 service authentication failed')
    const result = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(await response.json())
    tokens.set(key, { token: result.access_token, expires: Date.now() + Math.max(0, result.expires_in - 60) * 1000 })
    return result.access_token
  })()
  pending.set(key, task)
  try { return await task } finally { pending.delete(key) }
}
