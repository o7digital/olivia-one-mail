import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AIError, resolveAIRoute, type AIConfig } from './aiRouting.js'

const paths = {
  summary: '/email/summary', classification: '/email/classification',
  suggestedReply: '/email/suggested-reply', rewrite: '/text/rewrite',
  compose: '/email/compose', actions: '/actions/extract',
} as const
const results = {
  summary: z.object({ summary: z.string() }),
  classification: z.object({ category: z.string(), confidence: z.number().min(0).max(1) }),
  suggestedReply: z.object({ reply: z.string(), requires_review: z.literal(true) }),
  rewrite: z.object({ text: z.string(), tone: z.string(), language: z.string() }),
  compose: z.object({ subject: z.string(), body: z.string(), requires_review: z.literal(true) }),
  actions: z.object({ actions: z.array(z.object({ type: z.literal('review'), description: z.string() })) }),
}
const envelope = z.object({ job_id: z.string().regex(/^[a-zA-Z0-9-]{1,128}$/), sandbox: z.literal(true), status: z.enum(['queued', 'running', 'succeeded', 'failed']), result: z.unknown().optional() })
const inflight = new Map<string, Promise<unknown>>()

export function callV3<K extends keyof typeof paths>(env: AIConfig, mailbox: string, operation: K, payload: Record<string, string>): Promise<z.infer<(typeof results)[K]>> {
  const route = resolveAIRoute(mailbox, env)
  if (route.engine !== 'v3' || !env.aiV3ApiUrl || !env.aiV3Token) throw new AIError('V3_UNAVAILABLE', 503, 'Olivia V3 sandbox temporarily unavailable')
  const base = env.aiV3ApiUrl.replace(/\/$/, '')
  let url: URL
  try { url = new URL(base) } catch { throw new AIError('V3_CONFIG_INVALID', 503, 'Olivia V3 sandbox configuration invalid') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !Number.isFinite(env.aiV3TimeoutMs ?? 30000) || !Number.isFinite(env.aiV3PollMs ?? 250)) {
    throw new AIError('V3_CONFIG_INVALID', 503, 'Olivia V3 sandbox configuration invalid')
  }
  // Tenant, mailbox, operation and full content scope retries, including after a gateway restart.
  const key = createHash('sha256').update(JSON.stringify([base, route.tenant, route.mailbox, operation, Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))])).digest('hex')
  // Credential rotation must not reuse a pending request authenticated by the old token.
  const flightKey = createHash('sha256').update(key + env.aiV3Token).digest('hex')
  const previous = inflight.get(flightKey)
  if (previous) return previous as Promise<z.infer<(typeof results)[K]>>
  const task = (async () => {
    const started = Date.now()
    const timeout = Math.min(120000, Math.max(10, env.aiV3TimeoutMs ?? 30000))
    const signal = AbortSignal.timeout(timeout)
    let jobId: string | undefined
    const request = async (path: string, body?: unknown) => {
      const response = await fetch(base + '/v1/olivia-one' + path, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal,
        headers: { authorization: `Bearer ${env.aiV3Token}`, 'x-tenant-id': route.tenant, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (!response.ok) throw new AIError('V3_UPSTREAM_ERROR', 503, 'Olivia V3 sandbox temporarily unavailable')
      return envelope.parse(await response.json())
    }
    try {
      let job = await request(paths[operation], { ...payload, idempotency_key: key })
      jobId = job.job_id
      // The submission envelope has no result, even for an idempotent succeeded replay.
      while (true) {
        job = await request('/jobs/' + jobId)
        if (job.job_id !== jobId) throw new Error('Job mismatch')
        if (job.status === 'failed') throw new AIError('V3_JOB_FAILED', 503, 'Olivia V3 sandbox job failed')
        if (job.status === 'succeeded') {
          const result = results[operation].parse(job.result)
          console.info(JSON.stringify({ event: 'olivia_one.v3.completed', operation, job_id: jobId, tenant: route.tenant, duration_ms: Date.now() - started, sandbox: true }))
          return result as z.infer<(typeof results)[K]>
        }
        await new Promise<void>((resolve, reject) => {
          if (signal.aborted) return reject(signal.reason)
          const onAbort = () => { clearTimeout(timer); reject(signal.reason) }
          const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, Math.min(5000, Math.max(1, env.aiV3PollMs ?? 250)))
          signal.addEventListener('abort', onAbort, { once: true })
        })
      }
    } catch (error) {
      const safe = signal.aborted ? new AIError('V3_TIMEOUT', 504, 'Olivia V3 sandbox timed out; retry safely') : error instanceof AIError ? error : new AIError('V3_INVALID_RESPONSE', 503, 'Olivia V3 sandbox temporarily unavailable')
      console.warn(JSON.stringify({ event: 'olivia_one.v3.failed', operation, job_id: jobId, tenant: route.tenant, duration_ms: Date.now() - started, code: safe.code }))
      throw safe
    }
  })()
  inflight.set(flightKey, task)
  void task.finally(() => inflight.delete(flightKey)).catch(() => {})
  return task
}
