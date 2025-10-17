// C:\AngelBot\license-server\server.js
// Node CJS (require) — mock backend สำหรับ AngelBot + License Console

const express = require('express');
const cors = require('cors');
const os = require('os');
const multer = require('multer');
const { nanoid } = require('nanoid');

const app = express();
app.use(cors());
app.use(express.json());

// รับ multipart/form-data (เช่น verify ใส่ไฟล์)
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------------------------------------
// In-memory state
// ---------------------------------------------------------
const KEEP_MS = 24 * 60 * 60 * 1000; // เก็บเทรดย้อนหลัง 24 ชม.

let STATE = {
  connected: false,
  running: false,
  accountType: 'PRACTICE',
  currency: 'USD',
  balance: 1000,
  hudMaxStep: 0,

  // mock เปิดออเดอร์ทุก ๆ N วินาที (ความถี่ "เริ่มไม้" — ไม่ใช่เวลาตัดสินผล)
  orderIntervalSec: 2,

  config: null,
  timer: null,
};

let TRADES = []; // ประวัติเทรด (24h ล่าสุด)

// ==== Equity (PNL) over time ================================================
// ใช้ “baseline + สะสมกำไรจาก TRADES” เพื่อสร้างกราฟทุกครั้งที่ถูกเรียก
let EQUITY_BASE = 1000; // baseline เริ่มต้น (จะถูกตั้งใหม่ตอน connect/start/reset)

function nowISO() { return new Date().toISOString(); }

function pushTrade(row) {
  TRADES.unshift(row);
  const cut = Date.now() - KEEP_MS;
  TRADES = TRADES.filter(t => new Date(t.timestamp).getTime() >= cut);
}

// สร้างข้อมูล equity จาก TRADES (เรียงเก่า→ใหม่แล้วสะสม)
function buildEquity(limit = 200) {
  const chronological = [...TRADES].reverse();
  let pnl = 0;
  const points = [];

  for (const t of chronological) {
    pnl += Number(t.profit || 0);
    points.push({
      ts: t.timestamp,                                  // ISO string
      balance: Number((EQUITY_BASE + pnl).toFixed(2)),  // ยอดคงเหลือสะสม
      pnl: Number(pnl.toFixed(2)),
    });
  }

  return {
    start_balance: EQUITY_BASE,
    running: STATE.running,
    connected: STATE.connected,
    points: points.slice(-Math.max(1, Number(limit) || 200)),
  };
}

// ---------------------------------------------------------
// Helpers (alias path /api/* และ /* ให้ใช้อันเดียวกัน)
// ---------------------------------------------------------
function mount(method, paths, ...handlers) {
  const arr = Array.isArray(paths) ? paths : [paths];
  const withApi = arr.map(p => (p.startsWith('/api') ? p : `/api${p.startsWith('/') ? '' : '/'}${p}`));
  const flat = [...new Set([...arr, ...withApi])];
  flat.forEach(p => app[method](p, ...handlers));
}

// ---------------------------------------------------------
// License endpoints (mock)
// ---------------------------------------------------------
let LATEST_LICENSE = {
  ok: true,
  status: 'valid',
  days_left: 30,
  enforce: true,
  require_checksum: false,
  file: 'qse6gwsgbgm.json',
  owner: 'AngelTeam',
  plan: 'pro',
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  reason: 'skip_checksum',
};

mount('get', '/license/status', (req, res) => {
  res.json(LATEST_LICENSE);
});

mount('post', '/license/check', upload.single('file'), (req, res) => {
  if (req.file) LATEST_LICENSE.file = req.file.originalname || 'uploaded.json';
  return res.json(LATEST_LICENSE);
});

mount('post', '/license/gen', (req, res) => {
  const { owner = 'AngelTeam', days = 30, plan = 'pro' } = req.body || {};
  const file = `${nanoid(10)}.json`;
  LATEST_LICENSE = {
    ok: true,
    status: 'valid',
    days_left: Number(days) || 0,
    enforce: true,
    require_checksum: false,
    file,
    owner,
    plan,
    valid_until: new Date(Date.now() + (Number(days) || 0) * 24 * 60 * 60 * 1000).toISOString(),
    reason: 'skip_checksum',
  };
  res.json({ message: 'generated', license: LATEST_LICENSE });
});

// ---------------------------------------------------------
// System / Ping
// ---------------------------------------------------------
mount('get', '/ping', (_req, res) => res.json({ ok: true, ts: nowISO() }));
mount('get', '/system/hwid', (_req, res) => {
  const id = `${os.hostname()}-${os.platform()}-${os.arch()}`;
  res.json({ hwid: id });
});

// ---------------------------------------------------------
// Connect / Disconnect
// ---------------------------------------------------------
mount('post', '/connect', (req, res) => {
  const { account_type } = req.body || {};
  STATE.connected = true;
  STATE.accountType = account_type === 'REAL' ? 'REAL' : 'PRACTICE';

  // ตั้ง baseline ของกราฟเท่ากับยอดปัจจุบัน เมื่อ connect
  EQUITY_BASE = Number(STATE.balance || 0);

  return res.json({
    message: 'Connected',
    balance: STATE.balance,
    currency_code: STATE.currency,
    account_type: STATE.accountType,
  });
});

mount('post', '/disconnect', (_req, res) => {
  STATE.connected = false;
  stopEngine();
  // ไม่เปลี่ยน baseline ตอน disconnect (คงไว้เพื่อเปรียบเทียบ)
  return res.json({ message: 'Disconnected', connected: false });
});

// ---------------------------------------------------------
// Engine status
// ---------------------------------------------------------
mount('get', '/status', (_req, res) => {
  res.json({
    is_connected: STATE.connected,
    is_bot_running: STATE.running,
    balance: STATE.balance,
    currency_code: STATE.currency,
    account_type: STATE.accountType,
    hud_max_step: STATE.hudMaxStep,
  });
});

// ---------------------------------------------------------
// Engine core (mock) + endpoints
// ---------------------------------------------------------
function withinBlock(blockStart, blockEnd) {
  if (!blockStart && !blockEnd) return true;
  const hhmm = new Date().toTimeString().slice(0, 5); // "HH:mm"
  if (blockStart && !blockEnd) return hhmm >= blockStart;
  if (!blockStart && blockEnd) return hhmm <= blockEnd;
  if (blockStart <= blockEnd) return hhmm >= blockStart && hhmm <= blockEnd;
  // ข้ามเที่ยงคืน
  return hhmm >= blockStart || hhmm <= blockEnd;
}

function leadTimePassed(leadSec, durationMin) {
  const s = new Date().getSeconds();
  if (durationMin === 1 || durationMin === 5) {
    // ช่วงวินาทีสุดท้ายก่อนขึ้นนาทีใหม่
    return s >= 60 - Math.max(1, Math.min(15, leadSec));
  }
  return true;
}

function trendFilterOK() {
  return Math.random() < 0.9;
}
function microFilter5mOK() {
  return Math.random() < 0.9;
}
function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mockResult() {
  const r = Math.random();
  if (r < 0.52) return 'WIN';
  if (r < 0.92) return 'LOSE';
  return 'EQUAL';
}

function startEngine(cfg = {}) {
  if (STATE.timer) clearInterval(STATE.timer);

  // ตั้ง baseline ของกราฟตอนเริ่มบอท (อ้างอิงยอด ณ ตอนเริ่ม)
  EQUITY_BASE = Number(STATE.balance || 0);

  const c = {
    ...cfg,
    assets: Array.isArray(cfg.assets) && cfg.assets.length ? cfg.assets : ['EURUSD'],
    duration: cfg.duration === 5 ? 5 : 1,
    amount: Number(cfg.amount || 1),
    block_start: cfg.block_start || null,
    block_end: cfg.block_end || null,
    lead_time_sec: Number(cfg.lead_time_sec || 5),
    strategy_name: cfg.strategy_name || 'demo',
    micro_filter_5m: Boolean(cfg.micro_filter_5m),

    // 👉 ใช้ตอนเทส: ถ้าส่ง preview_ms (>0) จะย่นเวลารอผลแทน 1m/5m
    preview_ms: Number(cfg.preview_ms || 0),
  };

  STATE.config = c;
  STATE.running = true;

  STATE.timer = setInterval(() => {
    if (!STATE.running || !STATE.connected) return;

    if (!withinBlock(c.block_start, c.block_end)) return;
    if (!leadTimePassed(c.lead_time_sec, c.duration)) return;
    if (!trendFilterOK()) return;
    if (c.duration === 5 && c.micro_filter_5m && !microFilter5mOK()) return;

    // --- ORDER: สร้างรายการแบบ PENDING ก่อน แล้วค่อยตัดสินผล ---
    const asset = pickOne(c.assets);
    const dir = Math.random() < 0.5 ? 'CALL' : 'PUT';
    const amount = c.amount;

    // 1) เพิ่มรายการสถานะ "PENDING"
    const id = nanoid(8);
    pushTrade({
      id,
      timestamp: nowISO(),
      asset,
      direction: dir,
      amount: Number(amount.toFixed(2)),
      mg_step: 1,
      result: 'PENDING', // แสดงสถานะรอผล
      profit: 0,
      strategy: c.strategy_name,
      duration: c.duration,
    });

    // 2) ครบระยะเวลา แล้วค่อยตัดสินผล + อัปเดต balance & รายการเดิม
    const resolveMs =
      c.preview_ms > 0 ? c.preview_ms : Math.max(1, c.duration) * 60 * 1000; // ใช้ preview_ms ถ้ามี
    setTimeout(() => {
      const result = mockResult(); // 'WIN' | 'LOSE' | 'EQUAL'
      const payout = 0.87;
      let profit = 0;
      if (result === 'WIN') profit = amount * payout;
      else if (result === 'LOSE') profit = -amount;

      // อัปเดตรายการเดิมจาก PENDING -> ผลลัพธ์จริง
      const idx = TRADES.findIndex(t => t.id === id);
      if (idx !== -1) {
        TRADES[idx] = {
          ...TRADES[idx],
          result,
          profit: Number(profit.toFixed(2)),
        };
      }

      // ปรับ balance หลังทราบผล
      STATE.balance = Number((STATE.balance + profit).toFixed(2));
      // หมายเหตุ: /equity จะสร้างกราฟจาก TRADES เมื่อถูกเรียกใช้งาน
    }, resolveMs);
  }, STATE.orderIntervalSec * 1000);
}

function stopEngine() {
  if (STATE.timer) clearInterval(STATE.timer);
  STATE.timer = null;
  STATE.running = false;
}

mount('post', '/bot/start', (req, res) => {
  if (!STATE.connected) return res.status(400).json({ message: 'Connect first' });
  startEngine(req.body || {});
  res.json({ message: 'Bot started' });
});

mount('post', '/bot/stop', (_req, res) => {
  stopEngine();
  res.json({ message: 'Bot stopped' });
});

// ---------------------------------------------------------
// Trades + Equity
// ---------------------------------------------------------
mount('get', '/trades', (req, res) => {
  const limit = Math.min(10000, Math.max(1, Number(req.query.limit || 200)));
  res.json({ trades: TRADES.slice(0, limit) });
});

mount('post', '/trades/export', (_req, res) => {
  const rows = TRADES.map(t =>
    [t.timestamp, t.asset, t.direction, t.amount, t.mg_step, t.result, t.profit, t.strategy].join(',')
  );
  const csv = 'timestamp,asset,direction,amount,mg_step,result,profit,strategy\n' + rows.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="trades_${Date.now()}.csv"`);
  res.send(csv);
});

// NEW: equity endpoints
mount('get', '/equity', (req, res) => {
  const limit = Math.min(10000, Math.max(1, Number(req.query.limit || 200)));
  res.json(buildEquity(limit));
});

mount('post', '/equity/reset', (_req, res) => {
  EQUITY_BASE = Number(STATE.balance || 0);
  res.json({ ok: true, start_balance: EQUITY_BASE });
});

// ---------------------------------------------------------
// Indicators / Market hours (mock)
// ---------------------------------------------------------
mount('post', '/indicators/live', (req, res) => {
  const { asset, tf } = req.body || {};
  const last = Number((100 + Math.random() * 50).toFixed(5));
  const slope = (Math.random() - 0.5) * 0.002;
  const hist = (Math.random() - 0.5) * 0.01;
  res.json({
    asset: asset || 'EURUSD',
    tf: tf || 1,
    last,
    values: {
      ma: { type: 'EMA', length: 20, value: last, slope },
      macd: { hist },
      ichimoku: { position: ['above', 'below', 'inside'][Math.floor(Math.random() * 3)] },
      rsi: Number((30 + Math.random() * 40).toFixed(1)),
      bb: { mid: last, upper: last + 0.01, lower: last - 0.01 },
      stoch: { k: Math.round(20 + Math.random() * 60), d: Math.round(20 + Math.random() * 60) },
      atr: Number((Math.random() * 0.01).toFixed(5)),
      obv: Math.round((Math.random() - 0.5) * 100000),
    },
  });
});

mount('get', '/market-hours', (_req, res) => {
  res.json({
    timezone: 'Asia/Bangkok',
    assets: {
      EURUSD: [
        { dow: 'Mon', ranges: [['00:00', '24:00']] },
        { dow: 'Tue', ranges: [['00:00', '24:00']] },
        { dow: 'Wed', ranges: [['00:00', '24:00']] },
        { dow: 'Thu', ranges: [['00:00', '24:00']] },
        { dow: 'Fri', ranges: [['00:00', '24:00']] },
      ],
      XAUUSD: [
        { dow: 'Mon', ranges: [['01:00', '24:00']] },
        { dow: 'Tue', ranges: [['00:00', '24:00']] },
        { dow: 'Wed', ranges: [['00:00', '24:00']] },
        { dow: 'Thu', ranges: [['00:00', '24:00']] },
        { dow: 'Fri', ranges: [['00:00', '23:00']] },
      ],
    },
  });
});

// ---------------------------------------------------------
// Shutdown (optional, dev)
// ---------------------------------------------------------
mount('post', '/system/shutdown', (req, res) => {
  try {
    res.json({ ok: true });
  } finally {
    process.exit(0);
  }
});

// ---------------------------------------------------------
// Start server
// ---------------------------------------------------------
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`AngelBot backend running on http://127.0.0.1:${PORT}`);
  console.log('(alias routes active for both /api/* and /*)');
});
