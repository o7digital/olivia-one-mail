import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'

const SESSION_COOKIE = '__Host-olivia_session'
const CSRF_COOKIE = 'olivia_csrf'

function isProductionOrigin(origin: string) {
  return origin.startsWith('https://')
}

export function readSessionEmail(sessionValue: string | undefined) {
  if (!sessionValue) return null
  return sessionValue
}

export function clearSessionCookies(reply: FastifyReply, secureCookies: boolean) {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    sameSite: 'lax',
    secure: secureCookies,
  })
  reply.clearCookie(CSRF_COOKIE, {
    path: '/',
    sameSite: 'lax',
    secure: secureCookies,
  })
}

export function setSessionCookies(args: {
  reply: FastifyReply
  email: string
  csrfToken: string
  appOrigin: string
}) {
  const secureCookies = isProductionOrigin(args.appOrigin)
  args.reply
    .setCookie(SESSION_COOKIE, args.email, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: secureCookies,
      signed: true,
    })
    .setCookie(CSRF_COOKIE, args.csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: secureCookies,
    })
}

export function requireSession(): preHandlerHookHandler {
  return async function requireSessionPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const signedSession = request.unsignCookie(request.cookies[SESSION_COOKIE] ?? '')
    const email = signedSession.valid ? readSessionEmail(signedSession.value) : null
    if (!email) {
      return reply.code(401).send({ message: 'Authentication required' })
    }
    request.session = { email }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: {
      email: string
    }
  }
}
