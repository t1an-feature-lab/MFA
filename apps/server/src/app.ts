import { Hono } from 'hono'
import { pool } from './db.js'

export const app = new Hono()

app.get('/api/health', async (c) => {
  try {
    await pool.query('SELECT 1')
    return c.json({ status: 'ok' })
  } catch (error) {
    console.error('Database health check failed', error)
    return c.json({ status: 'error' }, 503)
  }
})
