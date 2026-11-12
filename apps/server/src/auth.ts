import { createHash, randomBytes } from 'node:crypto'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { pool } from './db.js'

export type SessionUser = {
  id: string
  phone: string | null
  username: string | null
  role: 'user' | 'admin'
}

const sessionCookie = 'mfa_session'
const sessionMaxAge = 7 * 24 * 60 * 60
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax' as const,
  path: '/',
}

export function sessionHash(c: Context) {
  const token = getCookie(c, sessionCookie)
  return token && /^[a-f0-9]{64}$/.test(token)
    ? createHash('sha256').update(token).digest('hex')
    : null
}

export async function getSessionUser(c: Context) {
  const hash = sessionHash(c)
  if (!hash) return null

  const { rows } = await pool.query<SessionUser>(
    `SELECT users.id, users.phone, users.username, users.role
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
    [hash],
  )
  return rows[0] ?? null
}

export async function createSession(c: Context, userId: string, passwordHash: string) {
  const token = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(token).digest('hex')

  const result = await pool.query(
    `WITH account AS (
       SELECT id FROM users WHERE id = $3 AND password_hash = $5 FOR UPDATE
     ), removed AS (
       DELETE FROM sessions USING account WHERE token_hash = $1 OR expires_at <= now()
     )
     INSERT INTO sessions (token_hash, user_id, expires_at)
     SELECT $2, id, $4 FROM account`,
    [sessionHash(c), hash, userId, new Date(Date.now() + sessionMaxAge * 1000), passwordHash],
  )
  if (!result.rowCount) return false
  setCookie(c, sessionCookie, token, { ...cookieOptions, maxAge: sessionMaxAge })
  return true
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, sessionCookie, cookieOptions)
}

export async function deleteSession(c: Context) {
  const hash = sessionHash(c)
  if (hash) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hash])
  clearSessionCookie(c)
}
