import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'

const SESSION_COOKIE = 'olivia_session'
const CSRF_COOKIE = 'olivia_csrf'

function isProductionOrigin(origin: string) {
  return origin.startsWith('https://')
}

export function buildSessionValue(email: string, cookieSecret: string) {
  return `${email}:${cookieSecret}`
}

export function readSessionEmail(sessionValue: string | undefined, cookieSecret: string) {
  if (!sessionValue) return null
  const [email, secret] = sessionValue.split(':')
  if (!email || !secret) return null
  if (secret !== cookieSecret) return null
  return email
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
  cookieSecret: string
  csrfToken: string
  appOrigin: string
}) {
  const secureCookies = isProductionOrigin(args.appOrigin)
  args.reply
    .setCookie(SESSION_COOKIE, buildSessionValue(args.email, args.cookieSecret), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: secureCookies,
    })
    .setCookie(CSRF_COOKIE, args.csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: secureCookies,
    })
}

export function requireSession(cookieSecret: string): preHandlerHookHandler {
  return async function requireSessionPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const email = readSessionEmail(request.cookies[SESSION_COOKIE], cookieSecret)
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
