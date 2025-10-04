// server.js — AngelBot mock backend following process_of_bot
// Run: npm i express cors nanoid
//      node server.js
const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

// ------------------- In-memory state -------------------
let STATE = {
  connected: false,
  running: false,
  accountType: 'PRACTICE',
  currency: 'USD',
  balance: 1000,
  hudMaxStep: 0,
  timer: null,
  orderIntervalSec: 2,
  config: null,           // payload จาก /bot/start
  sessionRound: 1,
};

let TRADES = [];          // เก็บ 24 ชม. ล่าสุด
const KEEP_MS = 24*60*60*1000;

function pushTrade(t) {
  TRADES.unshift(t);
  const cut = Date.now() - KEEP_MS;
  TRADES = TRADES.filter(x => new Date(x.timestamp).getTime() >= cut);
}

// ------------------- Helpers -------------------
function nowISO() { return new Date().toISOString(); }

function withinBlock(blockStart, blockEnd) {
  if (!blockStart && !blockEnd) return true;
  const hhmm = new Date().toTimeString().slice(0,5);
  if (blockStart && !blockEnd) return hhmm >= blockStart;
  if (!blockStart && blockEnd) return hhmm <= blockEnd;
  if (blockStart <= blockEnd) return (hhmm >= blockStart && hhmm <= blockEnd);
  // ช่วงข้ามเที่ยงคืน
  return (hhmm >= blockStart || hhmm <= blockEnd);
}

function leadTimePassed(leadSec, durationMin) {
  const d = new Date();
  const s = d.getSeconds();
  if (durationMin === 1 || durationMin === 5) {
    // แค่เช็คช่วงวินาทีสุดท้ายก่อนขึ้นนาทีใหม่
    return s >= (60 - Math.max(1, Math.min(15, leadSec)));
  }
  return true;
}

function pickOne(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

// mock filters: ปัจจุบันให้ผ่าน 90%
function trendFilterOK() { return Math.random() < 0.90; }
function microFilter5mOK() { return Math.random() < 0.90; }

// mock signal/result
function mockResult() {
  const r = Math.random();
  if (r < 0.52) return 'WIN';
  if (r < 0.92) return 'LOSE';
  return 'EQUAL';
}

// ------------------- Core engine (process_of_bot) -------------------
function startEngine(cfg) {
  if (STATE.timer) clearInterval(STATE.timer);

  STATE.config = {
    ...cfg,
    assets: Array.isArray(cfg.assets) && cfg.assets.length ? cfg.assets : ['EURUSD'],
    duration: cfg.duration === 5 ? 5 : 1,
    amount: Number(cfg.amount || 1),
    block_start: cfg.block_start || null,
    block_end: cfg.block_end || null,
    lead_time_sec: Number(cfg.lead_time_sec || 5),
  };

  STATE.running = true;

  STATE.timer = setInterval(() => {
    if (!STATE.running || !STATE.connected) return;
    const c = STATE.config;

    // Gate: ช่วงเวลา
    if (!withinBlock(c.block_start, c.block_end)) return;
    // Gate: lead time ก่อนนาที :00
    if (!leadTimePassed(c.lead_time_sec, c.duration)) return;
    // Gate: filters
    if (!trendFilterOK()) return;
    if (c.duration === 5 && c.micro_filter_5m === true && !microFilter5mOK()) return;

    // เลือก asset
    const asset = pickOne(c.assets);
    // mock ทิศ, ผลลัพธ์
    const dir = Math.random() < 0.5 ? 'CALL' : 'PUT';
    const result = mockResult();
    const amount = c.amount;
    const payout = 0.87;

    let profit = 0;
    if (result === 'WIN') profit = amount * payout;
    else if (result === 'LOSE') profit = -amount;

    // update balance
    STATE.balance = Number((STATE.balance + profit).toFixed(2));

    const row = {
      id: nanoid(8),
      timestamp: nowISO(),
      asset,
      direction: dir,
      amount: Number(amount.toFixed(2)),
      mg_step: 1,                 // MG ยังไม่เปิดใช้ใน UI เวอร์ชันนี้
      result,
      profit: Number(profit.toFixed(2)),
      strategy: c.strategy_name || '-',
      duration: c.duration,
    };
    pushTrade(row);
  }, (STATE.orderIntervalSec * 1000));
}

function stopEngine() {
  if (STATE.timer) clearInterval(STATE.timer);
  STATE.timer = null;
  STATE.running = false;
}

// ------------------- Endpoints -------------------
app.post('/license/check', (req, res) => {
  const { license_key } = req.body || {};
  if (!license_key) return res.status(400).json({ message: 'license_key required' });
  // mock verify
  return res.json({ message: 'License verified.' });
});

app.get('/system/hwid', (req, res) => {
  const id = `${os.hostname()}-${os.platform()}-${os.arch()}`;
  res.json({ hwid: id });
});

app.post('/connect', (req, res) => {
  const { email, password, account_type } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email/password required' });
  STATE.connected = true;
  STATE.accountType = account_type === 'REAL' ? 'REAL' : 'PRACTICE';
  res.json({
    message: 'Connected',
    balance: STATE.balance,
    currency_code: STATE.currency,
    account_type: STATE.accountType
  });
});

app.get('/status', (req, res) => {
  res.json({
    is_connected: STATE.connected,
    is_bot_running: STATE.running,
    balance: STATE.balance,
    currency_code: STATE.currency,
    account_type: STATE.accountType,
    hud_max_step: STATE.hudMaxStep,
  });
});

app.post('/bot/start', (req, res) => {
  if (!STATE.connected) return res.status(400).json({ message: 'Connect first' });
  startEngine(req.body || {});
  res.json({ message: `Bot started (tf=${STATE.config.duration}m)` });
});

app.post('/bot/stop', (req, res) => {
  stopEngine();
  res.json({ message: 'Bot stopped' });
});

app.get('/trades', (req, res) => {
  const limit = Math.min(10000, Math.max(1, Number(req.query.limit || 200)));
  res.json({ trades: TRADES.slice(0, limit) });
});

app.post('/trades/export', (req, res) => {
  const rows = TRADES.map(t =>
    [t.timestamp, t.asset, t.direction, t.amount, t.mg_step, t.result, t.profit, t.strategy].join(',')
  );
  const csv = 'timestamp,asset,direction,amount,mg_step,result,profit,strategy\n' + rows.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="trades_${Date.now()}.csv"`);
  res.send(csv);
});

app.post('/indicators/live', (req, res) => {
  const { asset, tf } = req.body || {};
  // mock series
  const last = Number((100 + Math.random()*50).toFixed(5));
  const slope = (Math.random() - 0.5) * 0.002;
  const hist = (Math.random() - 0.5) * 0.01;
  res.json({
    asset: asset || 'EURUSD',
    tf: tf || 1,
    last,
    values: {
      ma: { type: 'EMA', length: 20, value: last, slope },
      macd: { hist },
      ichimoku: { position: ['above','below','inside'][Math.floor(Math.random()*3)] },
      rsi: Number((30 + Math.random()*40).toFixed(1)),
      bb: { mid: last, upper: last+0.01, lower: last-0.01 },
      stoch: { k: Math.round(20 + Math.random()*60), d: Math.round(20 + Math.random()*60) },
      atr: Number((Math.random()*0.01).toFixed(5)),
      obv: Math.round((Math.random()-0.5)*100000),
    }
  });
});

app.get('/market-hours', (req, res) => {
  // ตัวอย่างตาม UI
  res.json({
    timezone: 'Asia/Bangkok',
    assets: {
      'EURUSD': [
        { dow: 'Mon', ranges: [['00:00','24:00']] },
        { dow: 'Tue', ranges: [['00:00','24:00']] },
        { dow: 'Wed', ranges: [['00:00','24:00']] },
        { dow: 'Thu', ranges: [['00:00','24:00']] },
        { dow: 'Fri', ranges: [['00:00','24:00']] },
      ],
      'XAUUSD': [
        { dow: 'Mon', ranges: [['01:00','24:00']] },
        { dow: 'Tue', ranges: [['00:00','24:00']] },
        { dow: 'Wed', ranges: [['00:00','24:00']] },
        { dow: 'Thu', ranges: [['00:00','24:00']] },
        { dow: 'Fri', ranges: [['00:00','23:00']] },
      ],
    }
  });
});

app.post('/system/shutdown', (req, res) => {
  try { res.json({ ok: true }); } finally { process.exit(0); }
});

const PORT = 9000;
app.listen(PORT, () => console.log(`AngelBot backend running on http://127.0.0.1:${PORT}`));
