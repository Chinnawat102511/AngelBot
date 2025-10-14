// C:\AngelBot\angelbot-engine\server.mjs   (ESM)

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import fetch from 'node-fetch'
import { setTimeout as delay } from 'node:timers/promises'
import { createRequire } from 'node:module'

// ──────────────────────────────────────────────────────────
// โหลด libs ภายใน (CJS) ผ่าน createRequire
// ──────────────────────────────────────────────────────────
const require = createRequire(import.meta.url)
const { Logger }      = require('./lib/logger')
const { TradeEngine } = require('./lib/tradeEngine')
const { AutoTrader }  = require('./lib/autoTrader')

// ──────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────
const PORT = Number(process.env.ENGINE_PORT || process.env.PORT || 5050)

// ใช้ LICENSE_BASE เป็นหลัก; ถ้าไม่มีค่อย fallback ไป LICENSE_SERVER_URL
const LICENSE_BASE = (
  process.env.LICENSE_BASE ||
  process.env.LICENSE_SERVER_URL ||
  'http://127.0.0.1:3001/api/forecast'
).replace(/\/+$/, '') // ตัด / ท้ายสุด

const LOG_DIR            = process.env.ENGINE_LOG_DIR || './logs'
const LICENSE_TIMEOUT_MS = Number(process.env.LICENSE_TIMEOUT_MS || 3000)
const LICENSE_RETRIES    = Number(process.env.LICENSE_RETRIES || 2)

// ──────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────
const asErrorMessage = (e) => String(e && e.message ? e.message : e)

const isPositiveNumber = (n) => Number.isFinite(n) && n > 0

function firstNumber (...vals) {
  for (const v of vals) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return NaN
}

// Ping license server (timeout + retry)
async function pingLicenseServer (baseUrl, { timeoutMs = 3000, retries = 2 } = {}) {
  const url = `${String(baseUrl || '').replace(/\/$/, '')}/ping`
  let lastErr

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const ctrl = new AbortController()
    const tm = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { method: 'GET', signal: ctrl.signal })
      clearTimeout(tm)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const raw = await res.text()
      try {
        const j = JSON.parse(raw)
        if (j && (j.ok === true || j.status === 'ok')) return true
      } catch {
        const txt = raw.trim().toLowerCase()
        if (txt === 'ok' || txt === 'pong') return true
      }
      throw new Error(`Invalid license response: ${raw}`)
    } catch (e) {
      clearTimeout(tm)
      lastErr = e
      if (attempt <= retries) await delay(300 * attempt) // backoff
      else break
    }
  }
  throw new Error(
    `License ping failed after ${retries + 1} attempt(s): ${asErrorMessage(lastErr)}`
  )
}

// ──────────────────────────────────────────────────────────
// App + Core objects
// ──────────────────────────────────────────────────────────
const app = express()

// CORS + รองรับ preflight ทุก path
app.use(cors({ origin: '*', credentials: false }))
app.options('*', cors())

// เก็บ rawBody (ไว้ debug เวลาส่ง JSON ผิด)
app.use(express.json({
  type: ['application/json', 'application/*+json'],
  limit: '1mb',
  verify: (req, _res, buf) => { try { req.rawBody = buf?.toString() ?? '' } catch {} }
}))
app.use(morgan('dev'))

const logger = new Logger(LOG_DIR)
const engine = new TradeEngine(logger)
const auto   = new AutoTrader(engine, logger) // จะอัปเดต config ตอน start

// Debug เฉพาะ /engine/signal
app.use((req, _res, next) => {
  if (req.method === 'POST' && req.path === '/engine/signal') {
    console.log('--- [/engine/signal] Incoming ---')
    console.log('content-type:', req.headers['content-type'])
    if (req.rawBody) console.log('rawBody:', req.rawBody)
    console.log('parsed body:', req.body)
    console.log('--------------------------------')
  }
  next()
})

// ──────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ ok: true, service: 'angelbot-engine' }))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'angelbot-engine',
    time: new Date().toISOString(),
    license_base: LICENSE_BASE
  })
})

app.get('/license/check', async (_req, res, next) => {
  try {
    await pingLicenseServer(LICENSE_BASE, {
      timeoutMs: LICENSE_TIMEOUT_MS, retries: LICENSE_RETRIES
    })
    res.json({ ok: true, pong: true })
  } catch (e) {
    next(Object.assign(new Error('license-unavailable'), {
      status: 503, detail: asErrorMessage(e)
    }))
  }
})

app.post('/engine/start', async (_req, res, next) => {
  try {
    await pingLicenseServer(LICENSE_BASE, {
      timeoutMs: LICENSE_TIMEOUT_MS, retries: LICENSE_RETRIES
    })
    const result = engine.start()
    res.json({ ok: true, ...result, status: engine.status() })
  } catch (e) {
    next(Object.assign(new Error('license-unavailable'), {
      status: 503, detail: asErrorMessage(e)
    }))
  }
})

app.post('/engine/stop', (_req, res) => {
  try { if (auto.running()) auto.stop() } catch {}
  const result = engine.stop()
  res.json({ ok: true, ...result, status: engine.status(), auto: auto.status() })
})

app.get('/engine/status', (_req, res) => {
  res.json({ ok: true, status: engine.status(), auto: auto.status() })
})

app.post('/engine/signal', (req, res, next) => {
  const { symbol, side } = req.body || {}
  const qty = firstNumber(req.body?.qty, req.body?.amount, req.body?.quantity, req.body?.size)

  if (!symbol || typeof symbol !== 'string' || !/^[A-Z0-9._-]{3,20}$/.test(symbol)) {
    return next(Object.assign(new Error('invalid symbol'), { status: 400 }))
  }
  if (side !== 'BUY' && side !== 'SELL') {
    return next(Object.assign(new Error('invalid side'), { status: 400 }))
  }
  if (!isPositiveNumber(qty)) {
    return next(Object.assign(new Error('invalid amount'), { status: 400 }))
  }

  const normalized = { ...req.body, qty: Number(qty) }
  delete normalized.amount; delete normalized.quantity; delete normalized.size

  const out = engine.executeSignal(normalized)
  if (!out?.ok) {
    return next(Object.assign(new Error(out?.error || 'signal failed'), { status: 400 }))
  }
  res.json(out)
})

app.get('/engine/trades', (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 50)))
  res.json({ ok: true, trades: engine.listTrades(limit) })
})

/* ──────────────────────────────────────────────────────────────
 * Auto Trader (EMA crossover simulator)
 * ────────────────────────────────────────────────────────────── */
app.post('/auto/start', async (req, res, next) => {
  try {
    await pingLicenseServer(LICENSE_BASE, {
      timeoutMs: LICENSE_TIMEOUT_MS, retries: LICENSE_RETRIES
    })

    if (!engine.isRunning) {
      const r = engine.start()
      if (!r.started) {
        return next(Object.assign(new Error(r.reason || 'engine-start-failed'), { status: 400 }))
      }
    }

    const cfg = { ...req.body }
    const q = firstNumber(cfg.qty, cfg.amount, cfg.quantity, cfg.size)
    if (isPositiveNumber(q)) cfg.qty = Number(q)
    delete cfg.amount; delete cfg.quantity; delete cfg.size

    if (auto.running()) auto.stop()
    auto.updateConfig(cfg)

    const result = auto.start()
    if (!result.ok) {
      return next(Object.assign(new Error(result.error || 'auto-start-failed'), { status: 400 }))
    }

    res.json({ ok: true, ...result, engine: engine.status(), auto: auto.status() })
  } catch (e) {
    next(Object.assign(new Error('auto-start-error'), { status: 500, detail: asErrorMessage(e) }))
  }
})

app.post('/auto/stop', (_req, res) => {
  const result = auto.stop()
  res.json({ ok: true, ...result, auto: auto.status(), engine: engine.status() })
})

app.get('/auto/status', (_req, res) => {
  res.json({ ok: true, auto: auto.status(), engine: engine.status() })
})

app.patch('/auto/config', (_req, res, next) => {
  try {
    const cfg = { ..._req.body }
    const q = firstNumber(cfg.qty, cfg.amount, cfg.quantity, cfg.size)
    if (isPositiveNumber(q)) cfg.qty = Number(q)
    delete cfg.amount; delete cfg.quantity; delete cfg.size

    const updated = auto.updateConfig(cfg)
    res.json({ ok: true, cfg: updated, auto: auto.status() })
  } catch (e) {
    next(Object.assign(new Error('auto-config-error'), { status: 400, detail: asErrorMessage(e) }))
  }
})

// 404
app.use((_req, _res, next) => next(Object.assign(new Error('Not Found'), { status: 404 })))

// Error handler
app.use((err, _req, res, _next) => {
  const status = Number(err.status || err.code || 500)
  const body = { ok: false, error: String(err.message || 'Unexpected error') }
  if (err.detail) body.detail = String(err.detail)
  res.status(status).json(body)
})

// ──────────────────────────────────────────────────────────
// Start & Graceful shutdown
// ──────────────────────────────────────────────────────────
const server = app.listen(PORT, async () => {
  console.log(`AngelBot Engine listening on http://localhost:${PORT}`)
  console.log(`License base: ${LICENSE_BASE} (engine will call <base>/ping)`)

  // Ping license ตอนบูต (log ให้เห็นผล)
  try {
    await pingLicenseServer(LICENSE_BASE, {
      timeoutMs: LICENSE_TIMEOUT_MS, retries: LICENSE_RETRIES
    })
    logger.info('🟩 License ping success:', JSON.stringify({ ok: true, base: LICENSE_BASE }))
  } catch (err) {
    logger.error('🟥 License ping failed:', asErrorMessage(err))
  }
})

function closeServer (signal) {
  console.log(`\n${signal} received → shutting down...`)
  try { if (auto.running()) auto.stop() } catch {}
  server.close(() => {
    console.log('HTTP server closed. Bye!')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 4000).unref()
}

process.on('SIGINT',  () => closeServer('SIGINT'))
process.on('SIGTERM', () => closeServer('SIGTERM'))
