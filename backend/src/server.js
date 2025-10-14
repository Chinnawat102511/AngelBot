// --- Node core ---
const fs   = require('fs');
const path = require('path');

// --- Paths for persistence ---
const DATA_DIR    = path.join(__dirname, '..', 'logs');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');

// --- Ensure data dir ---
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
ensureDataDir();

/** ------------------------------
 *  Runtime state (in-memory)
 * ------------------------------*/
let status = {
  is_connected: true,
  is_bot_running: false,
  balance: 10000,
  currency_code: 'USD',
  account_type: process.env.ACCOUNT_TYPE || 'practice',
  session_started_at: null,                      // เวลาเริ่มเซสชัน (ms)
  stats: { orders: 0, win: 0, lose: 0, draw: 0, session_pnl: 0 }
};

// เก็บ trade ล่าสุด
let trades = [];         // { id, ts, symbol, side, size, reqPrice, fillPrice, result, pnl, mgStep, strategy }
let nextId = 1;

// --- Load & Save trades (persistence) ---
function loadTradesFromDisk() {
  try {
    if (fs.existsSync(TRADES_FILE)) {
      const raw    = fs.readFileSync(TRADES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        trades = parsed;
        const maxId = trades.reduce((m, t) => Math.max(m, t.id || 0), 0);
        nextId = Math.max(nextId, maxId + 1);
      }
    }
  } catch (e) {
    console.warn('loadTradesFromDisk failed:', e.message);
  }
}
loadTradesFromDisk();

let saveTimer = null;
function saveTradesToDisk() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2), 'utf8');
    } catch (e) {
      console.warn('saveTradesToDisk failed:', e.message);
    }
  }, 200);
}

// --- Helpers ---
const nowIso = () => new Date().toISOString();
function randomOutcome() {
  const r = Math.random();
  if (r < 0.52) return 'WIN';
  if (r < 0.92) return 'LOSE';
  return 'DRAW';
}
function calcPnlBinary(amount, outcome) {
  const payout = 0.87;
  if (outcome === 'WIN') return +(amount * payout).toFixed(2);
  if (outcome === 'LOSE') return -amount;
  return 0; // DRAW
}
const DAY_MS = 24 * 60 * 60 * 1000;
function pruneOldTrades() {
  const cutoff = Date.now() - DAY_MS;
  trades = trades.filter(t => t.ts >= cutoff);
}
const maxMgStep = () => trades.reduce((m, t) => Math.max(m, t.mgStep || 1), 1);

// --- Web server ---
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const app = express();

// Middlewares
app.use(express.json());
app.use(morgan('dev'));
app.use(cors({
  origin: [/^http:\/\/localhost:\d+$/], // อนุญาต dev จาก Vite ทุกพอร์ต
  credentials: false,
}));

// Force 200 (no cache/etag) เพื่อลด 304 ที่ทำให้ fetch+proxy งง
app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

const PORT = Number(process.env.PORT) || 9050; // ใช้ 9050 ตามที่คุณทดสอบสะดวก

/** ------------------------------
 *  Health
 * ------------------------------*/
app.get('/health', (req, res) =>
  res.json({
    ok: true,
    service: 'angelbot-backend',
    time: nowIso(),
    running: status.is_bot_running,
    connected: status.is_connected
  })
);

/** ------------------------------
 *  Engine API
 * ------------------------------*/
app.get('/engine/status', (req, res) => {
  res.json({
    ok: true,
    status: {
      running:   status.is_bot_running,
      connected: status.is_connected,
      balance:   status.balance,
      account_type: status.account_type,
      stats: status.stats,
      session_started_at: status.session_started_at,
      max_mg_step: maxMgStep(),
      trades_count: trades.length,
      last_trade: trades[0] || null
    }
  });
});

app.post('/engine/start', (req, res) => {
  if (!status.is_connected) {
    return res.status(503).json({ ok: false, error: 'not-connected' });
  }
  status.is_bot_running = true;
  status.stats.session_pnl = 0;
  if (!status.session_started_at) status.session_started_at = Date.now();
  res.json({ ok: true, message: 'bot-started' });
});

app.post('/engine/stop', (req, res) => {
  status.is_bot_running = false;
  res.json({ ok: true, message: 'bot-stopped' });
});

// Quick BUY/SELL  body: { symbol, side, size, price }
app.post('/engine/signal', async (req, res) => {
  const { symbol, side, size, price } = req.body || {};
  if (!status.is_bot_running) {
    return res.status(400).json({ ok: false, error: 'bot-not-running' });
  }
  if (!symbol || !side || !size || isNaN(Number(size))) {
    return res.status(400).json({ ok: false, error: 'bad-request' });
  }

  status.stats.orders += 1;

  await new Promise(r => setTimeout(r, 700)); // mock delay

  const fillPrice = Number(price ?? 1.10000);
  const outcome   = randomOutcome();
  const pnl       = calcPnlBinary(Number(size), outcome);

  if (outcome === 'WIN') status.stats.win  += 1;
  else if (outcome === 'LOSE') status.stats.lose += 1;
  else status.stats.draw += 1;

  status.stats.session_pnl = +(status.stats.session_pnl + pnl).toFixed(2);
  status.balance = +(status.balance + pnl).toFixed(2);

  const trade = {
    id: nextId++,
    ts: Date.now(),
    symbol: String(symbol).toUpperCase(),
    side:   String(side).toUpperCase(),  // BUY/SELL
    size:   Number(size),                // amount $
    reqPrice: Number(price ?? fillPrice),
    fillPrice,
    result: outcome,                     // WIN/LOSE/DRAW
    pnl,
    mgStep: Math.ceil(Math.random() * 4),// จำลอง 1..4 ให้เหมือนตัวอย่าง
    strategy: 'AI Model (1m)'
  };

  trades.unshift(trade);
  if (trades.length > 10000) trades.pop();
  saveTradesToDisk();

  res.json({ ok: true, placed: trade });
});

// History (limit 1..1000, default 30)
app.get('/engine/trades', (req, res) => {
  pruneOldTrades();
  const limitRaw = req.query.limit ?? 30;
  const limit = Math.min(Math.max(Number(limitRaw) || 30, 1), 1000);
  res.json({ ok: true, trades: trades.slice(0, limit) });
});

// Reset session (ล้างประวัติ+รีเซ็ตสถิติ แต่ไม่ปิดบอท)
app.post('/engine/reset-session', (req, res) => {
  trades = [];
  nextId = 1;
  status.stats = { orders: 0, win: 0, lose: 0, draw: 0, session_pnl: 0 };
  status.session_started_at = Date.now();
  saveTradesToDisk();
  res.json({ ok: true, reset: true });
});

// Export CSV
app.get('/engine/trades.csv', (req, res) => {
  pruneOldTrades();
  const header = ['id','timestamp','asset','direction','amount','mg_step','result','profit','strategy'];
  const rows = trades.map(t => [
    t.id,
    new Date(t.ts).toISOString(),
    t.symbol,
    t.side === 'BUY' ? 'CALL' : 'PUT',
    t.size.toFixed(2),
    t.mgStep ?? 1,
    t.result ?? '',
    t.pnl.toFixed(2),
    t.strategy ?? ''
  ]);
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="trades.csv"');
  res.send(csv);
});

// ----------------- start server + graceful shutdown -----------------
const server = app.listen(PORT, () => {
  console.log(`AngelBot backend listening on http://127.0.0.1:${PORT}`);
});

function shutdown(sig) {
  console.log(`\n${sig} received. Shutting down...`);
  server.close(() => process.exit(0));
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
