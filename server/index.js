import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.ANGEL_PORT ? Number(process.env.ANGEL_PORT) : 8787
const TMP_DIR = path.join(__dirname, 'tmp')
const PID_FILE = path.join(TMP_DIR, 'license.pid')
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })
fs.writeFileSync(PID_FILE, String(process.pid))

// --- root & health
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'AngelServer',
    hint: 'ลอง GET /api/ping หรือ POST /api/license/generate',
    endpoints: {
      ping: '/api/ping',
      generateLicense: { method: 'POST', path: '/api/license/generate' }
    },
    time: new Date().toISOString()
  })
})
app.get('/health', (_req, res) => { res.send('OK') })

// --- ping
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, msg: 'pong', server: 'Angel License / Utility', time: new Date().toISOString() })
})

// --- license generate
app.post('/api/license/generate', async (req, res) => {
  try {
    const { default: generateLicense } = await import('./license/generate.js')
    const payload = req.body || {}
    const result = generateLicense(payload)
    res.json({ ok: true, license: result })
  } catch (e) {
    console.error(e)
    res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
})

app.listen(PORT, () => {
  console.log(`[AngelServer] running on http://localhost:${PORT}`)
})
