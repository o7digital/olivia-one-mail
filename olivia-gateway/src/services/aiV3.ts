import { getV3Token } from './aiV3Auth.js'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AIError, resolveAIRoute, type AIConfig } from './aiRouting.js'

const paths = {
  summary: '/email/summary', classification: '/email/classification',
  suggestedReply: '/email/suggested-reply', rewrite: '/text/rewrite',
  compose: '/email/compose', actions: '/actions/extract',
} as const
const providerMetadata = {
  provider: z.string().optional(), model: z.string().optional(), provider_response_id: z.string().nullable().optional(),
  provider_duration_ms: z.number().nonnegative().optional(), rag_hits: z.number().int().nonnegative().optional(),
  sources: z.array(z.object({
    kind: z.enum(['document', 'memory']), source: z.string(), document_id: z.number().int().nullable(), score: z.number(),
  })).optional(),
}
const results = {
  summary: z.object({ summary: z.string(), ...providerMetadata }),
  classification: z.object({ category: z.string(), confidence: z.number().min(0).max(1), ...providerMetadata }),
  suggestedReply: z.object({ reply: z.string(), requires_review: z.literal(true), ...providerMetadata }),
  rewrite: z.object({ text: z.string(), tone: z.string(), language: z.string(), ...providerMetadata }),
  compose: z.object({ subject: z.string(), body: z.string(), requires_review: z.literal(true), ...providerMetadata }),
  actions: z.object({ actions: z.array(z.object({ type: z.literal('review'), description: z.string() })), ...providerMetadata }),
}
const envelope = z.object({ job_id: z.string().regex(/^[a-zA-Z0-9-]{1,128}$/), sandbox: z.literal(true), status: z.enum(['queued', 'running', 'succeeded', 'failed']), result: z.unknown().optional() })
const inflight = new Map<string, Promise<unknown>>()

export function callV3<K extends keyof typeof paths>(env: AIConfig, mailbox: string, operation: K, payload: Record<string, unknown>): Promise<z.infer<(typeof results)[K]>> {
  const route = resolveAIRoute(mailbox, env)
  const hasTenantCredentials = Boolean(env.aiV3ServiceCredentialsMap?.[route.tenant]?.password)
  if (route.engine !== 'v3' || !env.aiV3ApiUrl || (!env.aiV3Token && !env.aiV3ServicePassword && !hasTenantCredentials)) throw new AIError('V3_UNAVAILABLE', 503, 'Olivia V3.5 is unavailable')
  const base = env.aiV3ApiUrl.replace(/\/$/, '')
  let url: URL
  try { url = new URL(base) } catch { throw new AIError('V3_CONFIG_INVALID', 503, 'Olivia V3 sandbox configuration invalid') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !Number.isFinite(env.aiV3TimeoutMs ?? 30000) || !Number.isFinite(env.aiV3PollMs ?? 250)) {
    throw new AIError('V3_CONFIG_INVALID', 503, 'Olivia V3 sandbox configuration invalid')
  }
  // Tenant, mailbox, operation and full content scope retries, including after a gateway restart.
  const key = createHash('sha256').update(JSON.stringify([base, route.tenant, route.mailbox, operation, Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))])).digest('hex')
  // Credential rotation must not reuse a pending request authenticated by the old token.
  const tenantCredentials = env.aiV3ServiceCredentialsMap?.[route.tenant]
  const flightKey = createHash('sha256').update(key + (env.aiV3Token || '') + (tenantCredentials?.email || env.aiV3ServiceEmail || '') + (tenantCredentials?.password || env.aiV3ServicePassword || '')).digest('hex')
  const previous = inflight.get(flightKey)
  if (previous) return previous as Promise<z.infer<(typeof results)[K]>>
  const task = (async () => {
    const started = Date.now()
    const timeout = Math.min(120000, Math.max(10, env.aiV3TimeoutMs ?? 30000))
    const signal = AbortSignal.timeout(timeout)
    let jobId: string | undefined
    let token: string
    const request = async (path: string, body?: unknown, retryTransient = false) => {
      const response = await fetch(base + '/v1/olivia-one' + path, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal,
        headers: { authorization: `Bearer ${token}`, 'x-tenant-id': route.tenant, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (retryTransient && [429, 502, 503, 504].includes(response.status)) return null
      if (!response.ok) throw new AIError('V3_UPSTREAM_ERROR', 503, 'Olivia V3.5 is unavailable')
      return envelope.parse(await response.json())
    }
    try {
      token = await getV3Token(env, route.tenant, signal)
      let job = await request(paths[operation], { ...payload, idempotency_key: key })
      if (!job) throw new AIError('V3_UPSTREAM_ERROR', 503, 'Olivia V3.5 is unavailable')
      jobId = job.job_id
      // The submission envelope has no result, even for an idempotent succeeded replay.
      while (true) {
        const polled = await request('/jobs/' + jobId, undefined, true)
        if (!polled) {
          await waitForPoll(signal, env.aiV3PollMs)
          continue
        }
        job = polled
        if (job.job_id !== jobId) throw new Error('Job mismatch')
        if (job.status === 'failed') throw new AIError('V3_JOB_FAILED', 503, 'Olivia V3.5 job failed')
        if (job.status === 'succeeded') {
          const result = results[operation].parse(job.result)
          console.info(JSON.stringify({ event: 'olivia_one.v3.completed', operation, job_id: jobId, tenant: route.tenant, duration_ms: Date.now() - started, provider: result.provider, model: result.model, provider_duration_ms: result.provider_duration_ms, rag_hits: result.rag_hits, sandbox: true }))
          return result as z.infer<(typeof results)[K]>
        }
        await waitForPoll(signal, env.aiV3PollMs)
      }
    } catch (error) {
      const safe = signal.aborted ? new AIError('V3_TIMEOUT', 504, 'Olivia V3.5 timed out; retry safely') : error instanceof AIError ? error : new AIError('V3_INVALID_RESPONSE', 503, 'Olivia V3.5 returned an invalid response')
      console.warn(JSON.stringify({ event: 'olivia_one.v3.failed', operation, job_id: jobId, tenant: route.tenant, duration_ms: Date.now() - started, code: safe.code }))
      throw safe
    }
  })()
  inflight.set(flightKey, task)
  void task.finally(() => inflight.delete(flightKey)).catch(() => {})
  return task
}

function waitForPoll(signal: AbortSignal, pollMs = 1000) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const onAbort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, Math.min(5000, Math.max(1, pollMs)))
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
