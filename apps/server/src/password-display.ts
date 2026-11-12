import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const keyHex = process.env.PASSWORD_ENCRYPTION_KEY
if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex)) {
  throw new Error('PASSWORD_ENCRYPTION_KEY must contain 64 hexadecimal characters')
}
const key = Buffer.from(keyHex, 'hex')

export function encryptPassword(password: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPassword(encrypted: string | null) {
  if (!encrypted) return null
  const match = /^v1:([a-f0-9]{24}):([a-f0-9]{32}):((?:[a-f0-9]{2}){1,384})$/.exec(encrypted)
  if (!match) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(match[1], 'hex'))
    decipher.setAuthTag(Buffer.from(match[2], 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(match[3], 'hex')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
