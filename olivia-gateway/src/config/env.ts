export function getEnv() {
  return {
    appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    cookieSecret: process.env.COOKIE_SECRET ?? 'olivia-one-dev-secret',
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 8787),
  }
}
