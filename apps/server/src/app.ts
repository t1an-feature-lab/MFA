import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { clearSessionCookie, createSession, deleteSession, getSessionUser, sessionHash } from './auth.js'
import type { SessionUser } from './auth.js'
import { pool } from './db.js'
import { decryptPassword, encryptPassword } from './password-display.js'
import { hashPassword, verifyPassword } from './password.js'
import { readOrders } from './orders.js'
import { createOrdersWorkbook } from './orders-export.js'

export const app = new Hono<{ Variables: { user: SessionUser } }>()

app.onError((error, c) => {
  console.error('API request failed', error.name)
  return c.json({ error: '服务暂时不可用，请稍后重试。' }, 500)
})

app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store')

  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const fetchSite = c.req.header('sec-fetch-site')
    const origin = c.req.header('origin')
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return c.json({ error: '不允许跨站请求。' }, 403)
    }
    if (origin) {
      try {
        // Compare hosts so an HTTPS reverse proxy can forward HTTP to the server.
        if (new URL(origin).host !== new URL(c.req.url).host) {
          return c.json({ error: '不允许跨站请求。' }, 403)
        }
      } catch {
        return c.json({ error: '请求来源无效。' }, 403)
      }
    }
  }

  await next()
})

app.use('/api/auth/*', bodyLimit({
  maxSize: 1024,
  onError: (c) => c.json({ error: '请求内容过长。' }, 413),
}))

app.use('/api/*', async (c, next) => {
  const publicRoute = (c.req.method === 'GET' && c.req.path === '/api/health')
    || (c.req.method === 'POST' && [
      '/api/auth/login', '/api/auth/logout',
    ].includes(c.req.path))
  if (publicRoute) return next()

  const user = await getSessionUser(c)
  if (!user) {
    clearSessionCookie(c)
    return c.json({ error: '请先登录。' }, 401)
  }
  c.set('user', user)
  if (user.role !== 'admin' && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)
    && !(c.req.method === 'POST' && c.req.path === '/api/auth/password')) {
    return c.json({ error: '仅查看用户不能修改数据。' }, 403)
  }
  await next()
})

app.post('/api/auth/login', async (c) => {
  const body: unknown = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object' || !('account' in body) || !('password' in body)
    || typeof body.account !== 'string' || typeof body.password !== 'string') {
    return c.json({ error: '请输入账号和密码。' }, 400)
  }

  const account = body.account.trim()
  const password = body.password
  if (account !== 'admin' && !/^1[3-9]\d{9}$/.test(account)) {
    return c.json({ error: '请输入有效的 11 位手机号或管理员账号。' }, 400)
  }
  if (password.length === 0 || password.length > 128) {
    return c.json({ error: '请输入 1 至 128 位密码。' }, 400)
  }

  type LoginUser = SessionUser & { password_hash: string | null }
  const { rows } = await pool.query<LoginUser>(
    `SELECT id, phone, username, role, password_hash FROM users
     WHERE phone = $1 OR (username = $1 AND role = 'admin')`,
    [account],
  )
  let user = rows[0]
  if (!user && account !== 'admin') {
    const { rows: created } = await pool.query<LoginUser>(
      `INSERT INTO users (id, phone, role, password_hash, password_encrypted) VALUES ($1, $2, 'user', $3, $4)
       ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, phone, username, role, password_hash`,
      [randomUUID(), account, await hashPassword(password), encryptPassword(password)],
    )
    user = created[0]
  }
  if (!user) throw new Error('Admin account has not been initialized')
  if (!user.password_hash) {
    return c.json({ error: '该账户尚未设置密码，请联系管理员。' }, 409)
  }
  const { password_hash, ...sessionUser } = user
  if (!await verifyPassword(password, password_hash)) {
    return c.json({ error: '账号或密码错误。' }, 401)
  }
  await pool.query(
    `UPDATE users SET password_encrypted = $1
     WHERE id = $2 AND password_hash = $3 AND password_encrypted IS NULL`,
    [encryptPassword(password), user.id, password_hash],
  )
  if (!await createSession(c, user.id, password_hash)) {
    return c.json({ error: '密码已变更，请使用新密码登录。' }, 400)
  }
  return c.json({ user: sessionUser })
})

app.get('/api/auth/me', (c) => c.json({ user: c.get('user') }))

app.get('/api/orders', async (c) => c.json({ orders: await readOrders(pool) }))

app.get('/api/orders/export', async (c) => {
  const orders = await readOrders(pool)
  const file = await createOrdersWorkbook(orders)
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
  return c.body(new Uint8Array(file), 200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="orders-${today}.xlsx"`,
  })
})

app.post('/api/auth/password', async (c) => {
  const body: unknown = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object' || !('currentPassword' in body) || !('newPassword' in body)
    || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string'
    || !body.currentPassword.length || body.currentPassword.length > 128
    || !body.newPassword.length || body.newPassword.length > 128) {
    return c.json({ error: '请输入 1 至 128 位当前密码和新密码。' }, 400)
  }

  const userId = c.get('user').id
  const { rows } = await pool.query<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1', [userId],
  )
  const currentHash = rows[0]?.password_hash
  if (!currentHash || !await verifyPassword(body.currentPassword, currentHash)) {
    return c.json({ error: '当前密码不正确。' }, 400)
  }

  const newHash = await hashPassword(body.newPassword)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `UPDATE users SET password_hash = $1, password_encrypted = $4
       WHERE id = $2 AND password_hash = $3 RETURNING id`,
      [newHash, userId, currentHash, encryptPassword(body.newPassword)],
    )
    if (!result.rowCount) {
      await client.query('ROLLBACK')
      return c.json({ error: '密码已变更，请重新输入当前密码。' }, 400)
    }
    await client.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [userId, sessionHash(c)])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return c.json({ ok: true })
})

app.get('/api/users', async (c) => {
  const { rows } = await pool.query<SessionUser & { hasPassword: boolean; password_encrypted: string | null }>(
    `SELECT id, phone, username, role, password_hash IS NOT NULL AS "hasPassword", password_encrypted
     FROM users ORDER BY username NULLS LAST, phone`,
  )
  return c.json({ users: rows.map(({ password_encrypted, ...user }) => ({
    ...user,
    password: decryptPassword(password_encrypted),
    passwordAvailable: password_encrypted !== null,
  })) })
})

app.patch('/api/users/:id/role', bodyLimit({
  maxSize: 1024,
  onError: (c) => c.json({ error: '请求内容过长。' }, 413),
}), async (c) => {
  const id = c.req.param('id')
  const body: unknown = await c.req.json().catch(() => null)
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
    || !body || typeof body !== 'object' || !('role' in body)
    || (body.role !== 'admin' && body.role !== 'user')) {
    return c.json({ error: '用户或权限无效。' }, 400)
  }
  const { rows } = await pool.query<{ username: string | null }>('SELECT username FROM users WHERE id = $1', [id])
  if (!rows.length) return c.json({ error: '用户不存在。' }, 404)
  if (rows[0].username === 'admin') return c.json({ error: '内置管理员权限不可修改。' }, 403)

  const result = await pool.query<SessionUser & { hasPassword: boolean; passwordAvailable: boolean }>(
    `UPDATE users SET role = $2 WHERE id = $1 AND username IS DISTINCT FROM 'admin'
     RETURNING id, phone, username, role, password_hash IS NOT NULL AS "hasPassword",
       password_encrypted IS NOT NULL AS "passwordAvailable"`,
    [id, body.role],
  )
  if (!result.rows.length) return c.json({ error: '用户不存在。' }, 404)
  return c.json({ user: { ...result.rows[0], password: null } })
})

app.post('/api/auth/logout', async (c) => {
  await deleteSession(c)
  return c.json({ ok: true })
})

app.get('/api/health', async (c) => {
  try {
    await pool.query('SELECT 1')
    return c.json({ status: 'ok' })
  } catch (error) {
    console.error('Database health check failed', error)
    return c.json({ status: 'error' }, 503)
  }
})
