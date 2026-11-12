import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

function deriveKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await deriveKey(password, salt)
  return `scrypt:${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string) {
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash)
  if (!match) return false
  const key = await deriveKey(password, match[1])
  return timingSafeEqual(key, Buffer.from(match[2], 'hex'))
}
