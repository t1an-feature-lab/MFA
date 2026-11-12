import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { encryptPassword } from './password-display.js'
import { hashPassword, verifyPassword } from './password.js'
import { initializeOrders } from './orders.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL connection error', error.message)
})

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      phone text UNIQUE,
      username text UNIQUE,
      role text NOT NULL CHECK (role IN ('user', 'admin'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_encrypted text;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'users'::regclass AND conname = 'users_identity_check'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_identity_check CHECK (
          ((phone IS NOT NULL AND username IS NULL) OR (phone IS NULL AND username IS NOT NULL))
          AND (username IS DISTINCT FROM 'admin' OR role = 'admin')
        );
      END IF;
    END $$;
  `)

  const { rows } = await pool.query<{ id: string; password_hash: string | null; password_encrypted: string | null }>(
    "SELECT id, password_hash, password_encrypted FROM users WHERE username = 'admin'",
  )
  if (!rows[0]?.password_hash) {
    // shortcut: admin/admin is a development credential; configure a real secret before deployment.
    await pool.query(
      `INSERT INTO users (id, username, role, password_hash, password_encrypted)
       VALUES ($1, 'admin', 'admin', $2, $3)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash, password_encrypted = EXCLUDED.password_encrypted
       WHERE users.password_hash IS NULL`,
      [randomUUID(), await hashPassword('admin'), encryptPassword('admin')],
    )
  } else if (rows[0].password_encrypted === null && await verifyPassword('admin', rows[0].password_hash)) {
    await pool.query(
      `UPDATE users SET password_encrypted = $1
       WHERE id = $2 AND password_hash = $3 AND password_encrypted IS NULL`,
      [encryptPassword('admin'), rows[0].id, rows[0].password_hash],
    )
  }
  await initializeOrders(pool)
}
