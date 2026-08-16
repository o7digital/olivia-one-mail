export function getEnv() {
  return {
    appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    cookieSecret: process.env.COOKIE_SECRET ?? 'olivia-one-dev-secret',
    host: process.env.HOST ?? '0.0.0.0',
    mailAuthPass: process.env.MAIL_AUTH_PASS ?? '',
    mailAuthUser: process.env.MAIL_AUTH_USER ?? '',
    mailcowNetwork: process.env.MAILCOW_NETWORK ?? 'mailcowdockerized_mailcow-network',
    port: Number(process.env.PORT ?? 8787),
  }
}
