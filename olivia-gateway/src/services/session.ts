import { createHash, randomBytes } from 'node:crypto'
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'

const SESSION_COOKIE = '__Host-olivia_session'
const CSRF_COOKIE = 'olivia_csrf'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

export interface SessionRecord {
  id: string
  email: string
  password: string
  createdAt: number
  expiresAt: number
}

const sessions = new Map<string, SessionRecord>()
let now = () => Date.now()

function isProductionOrigin(origin: string) {
  return origin.startsWith('https://')
}

function cleanupExpiredSessions(currentTime = now()) {
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= currentTime) sessions.delete(sessionId)
  }
}

export function buildSessionUser(email: string) {
  const localPart = email.split('@')[0] ?? 'mailbox'
  const label = localPart
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')

  return {
    id: createHash('sha256').update(email).digest('hex').slice(0, 16),
    name: label || email,
    email,
  }
}

export function createServerSession(input: { email: string; password: string }) {
  cleanupExpiredSessions()
  const createdAt = now()
  const session: SessionRecord = {
    id: randomBytes(24).toString('hex'),
    email: input.email,
    password: input.password,
    createdAt,
    expiresAt: createdAt + SESSION_TTL_MS,
  }
  sessions.set(session.id, session)
  return session
}

export function getServerSession(sessionId: string | undefined) {
  if (!sessionId) return null
  cleanupExpiredSessions()
  const session = sessions.get(sessionId)
  if (!session) return null
  if (session.expiresAt <= now()) {
    sessions.delete(sessionId)
    return null
  }
  return session
}

export function deleteServerSession(sessionId: string | undefined) {
  if (!sessionId) return
  sessions.delete(sessionId)
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
  sessionId: string
  csrfToken: string
  appOrigin: string
}) {
  const secureCookies = isProductionOrigin(args.appOrigin)
  args.reply
    .setCookie(SESSION_COOKIE, args.sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: secureCookies,
      signed: true,
      maxAge: SESSION_TTL_MS / 1000,
    })
    .setCookie(CSRF_COOKIE, args.csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: secureCookies,
      maxAge: SESSION_TTL_MS / 1000,
    })
}

export function getSignedSessionId(request: FastifyRequest) {
  const signedSession = request.unsignCookie(request.cookies[SESSION_COOKIE] ?? '')
  return signedSession.valid ? signedSession.value : null
}

export function requireSession(): preHandlerHookHandler {
  return async function requireSessionPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const sessionId = getSignedSessionId(request)
    const session = getServerSession(sessionId ?? undefined)
    if (!session) {
      return reply.code(401).send({ message: 'Authentication required' })
    }
    request.session = session
  }
}

export function __resetSessionsForTests() {
  sessions.clear()
  now = () => Date.now()
}

export function __setSessionClockForTests(clock: (() => number) | null) {
  now = clock ?? (() => Date.now())
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionRecord
  }
}
