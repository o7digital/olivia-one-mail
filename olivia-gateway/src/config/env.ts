function parseJsonMap(value: string | undefined, fallback: Record<string, string>) {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
        .map(([key, mapped]) => [key.trim().toLowerCase(), mapped.trim()]),
    )
  } catch {
    return fallback
  }
}

export function getEnv() {
  return {
    aiApiKey: process.env.AI_API_KEY ?? '',
    aiApiUrl: process.env.AI_API_URL ?? '',
    aiModel: process.env.AI_MODEL ?? 'gpt-4o-mini',
    aiProvider: process.env.AI_PROVIDER ?? 'mock',
    aiDefaultClientCode: process.env.AI_DEFAULT_CLIENT_CODE ?? 'default',
    aiMailboxClientMap: parseJsonMap(process.env.AI_MAILBOX_CLIENT_MAP, {}),
    aiDomainClientMap: parseJsonMap(process.env.AI_DOMAIN_CLIENT_MAP, {}),
    oliviaInternalToken: process.env.OLIVIA_INTERNAL_TOKEN ?? '',
    pulseCrmApiUrl: process.env.PULSE_CRM_API_URL ?? '',
    pulseCrmIntegrationSecret: process.env.PULSE_CRM_INTEGRATION_SECRET ?? '',
    appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    cookieSecret: process.env.COOKIE_SECRET ?? 'olivia-one-dev-secret',
    host: process.env.HOST ?? '0.0.0.0',
    mailcowNetwork: process.env.MAILCOW_NETWORK ?? 'mailcowdockerized_mailcow-network',
    port: Number(process.env.PORT ?? 8787),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  }
}
