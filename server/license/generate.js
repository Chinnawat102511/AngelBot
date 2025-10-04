import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SECRET = process.env.ANGEL_LICENSE_SECRET || 'dev_secret'
const ISSUER = process.env.ANGEL_LICENSE_ISSUER || 'AngelTeam'
const OUT_DIR = path.join(__dirname, '..', 'licenses')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

/**
 * payload: { userId, plan, expiresAt (ISO), features: string[] }
 */
export default function generateLicense(payload = {}) {
  const now = new Date().toISOString()
  const data = {
    issuer: ISSUER,
    issuedAt: now,
    userId: payload.userId || 'unknown',
    plan: payload.plan || 'basic',
    expiresAt: payload.expiresAt || new Date(Date.now() + 30 * 864e5).toISOString(),
    features: Array.isArray(payload.features) ? payload.features : ['forecast', 'alert']
  }

  const body = JSON.stringify(data)
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex')
  const license = { ...data, signature: sig }

  const file = path.join(OUT_DIR, `${data.userId}_${Date.now()}.license.json`)
  fs.writeFileSync(file, JSON.stringify(license, null, 2))
  return { file, license }
}
