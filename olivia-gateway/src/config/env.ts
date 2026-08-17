export function getEnv() {
  return {
    aiApiKey: process.env.AI_API_KEY ?? '',
    aiApiUrl: process.env.AI_API_URL ?? '',
    aiModel: process.env.AI_MODEL ?? 'gpt-4o-mini',
    aiProvider: process.env.AI_PROVIDER ?? 'mock',
    appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    cookieSecret: process.env.COOKIE_SECRET ?? 'olivia-one-dev-secret',
    host: process.env.HOST ?? '0.0.0.0',
    mailcowNetwork: process.env.MAILCOW_NETWORK ?? 'mailcowdockerized_mailcow-network',
    port: Number(process.env.PORT ?? 8787),
  }
}
