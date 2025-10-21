// ANGELBOT/server/server.js
// Flow: Verify → Connect → Start/Pause/Resume/Stop → Reset(ตอน Stop)
// ใช้ ESM ("type":"module")

import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ----------------- config -----------------
const PORT       = Number(process.env.PORT) || 3001;
const DATA_DIR   = path.join(__dirname, "backend_logs");
const TRADES_FN  = path.join(DATA_DIR, "trades.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ----------------- persistence -----------------
function loadTrades() {
  try {
    if (fs.existsSync(TRADES_FN)) {
      const a = JSON.parse(fs.readFileSync(TRADES_FN, "utf8"));
      if (Array.isArray(a)) return a;
    }
  } catch {}
  return [];
}
function saveTrades() {
  try { fs.writeFileSync(TRADES_FN, JSON.stringify(trades, null, 2), "utf8"); } catch {}
}

// ----------------- runtime state -----------------
let bot_state = "stopped"; // 'running' | 'paused' | 'stopped'
let conn = {
  is_connected: false, // ให้ UI เห็น Disconnected ตอนเริ่ม
  account_type: (process.env.ACCOUNT_TYPE || "PRACTICE").toUpperCase(),
};
let account = {
  balance: 1000,
  currency_code: "USD",
  session_started_at: null,
  stats: { orders: 0, win: 0, lose: 0, draw: 0, session_pnl: 0 },
};

let trades = loadTrades();
let nextId  = trades.reduce((m, t) => Math.max(m, t.id || 0), 0) + 1;

// ============ signal/loop config ============
const selectedAssets = new Set(["XAUUSD", "EURUSD"]); // UI ส่งมาใน /start หรือ /assets จะ override
const LOOP = { tickMs: 3000, amount: 10 };

// duration runtime (ค่าเริ่มต้น 1 นาที)
const DUR_MAP = { "1 Minute": "1m", "3 Minutes": "3m", "5 Minutes": "5m" };
let RUNTIME = { duration: "1m" }; // ใช้ตอนสร้าง trade

let loopTimer = null;

// ----------------- helpers -----------------
function randomOutcome() {
  const r = Math.random();
  if (r < 0.52) return "WIN";
  if (r < 0.92) return "LOSE";
  return "DRAW";
}
function calcPnlBinary(amount, outcome) {
  const payout = 0.87;
  if (outcome === "WIN") return +(amount * payout).toFixed(2);
  if (outcome === "LOSE") return -amount;
  return 0;
}

const fmtTradeForUI = (t) => ({
  id: t.id,
  timestamp: t.ts,
  asset: t.symbol,
  direction: t.side === "BUY" ? "CALL" : "PUT",
  amount: t.size,
  mgStep: t.mgStep ?? 1,
  duration: t.duration || RUNTIME.duration || "1m",
  result: t.result,
  result_pl: t.pnl,
  strategy: t.strategy || "Random (assets selection)",
});

function stateForUI() {
  return {
    status: bot_state,
    connected: conn.is_connected,
    accountType: conn.account_type,
    balance: account.balance,
    stats: account.stats,
  };
}

// ----------------- SSE -----------------
const sseClients = new Set();
function sseSnapshot(res) {
  const snap = trades.slice(0, 200).map(fmtTradeForUI);
  res.write(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
}
function ssePushTrade(t) {
  const payload = `event: trade\ndata: ${JSON.stringify(fmtTradeForUI(t))}\n\n`;
  for (const c of sseClients) {
    try { c.write(payload); } catch {}
  }
}

// ----------------- symbol pick (ดีที่สุดจากที่เลือก) -----------------
function pickBestSymbol() {
  const pool = [...selectedAssets].filter(Boolean);
  if (pool.length === 0) return "EURUSD";
  if (pool.length === 1) return pool[0];

  let best = null;
  for (const sym of pool) {
    const recent = trades.filter(t => t.symbol === sym).slice(0, 60);
    const wins   = recent.filter(t => t.result === "WIN").length;
    const losses = recent.filter(t => t.result === "LOSE").length;
    const score  = wins - losses;
    if (!best || score > best.score) best = { sym, score };
  }
  return best ? best.sym : pool[(Math.random() * pool.length) | 0];
}

// ----------------- loop -----------------
function tickTrade() {
  try {
    if (bot_state !== "running") return;

    const symbol = pickBestSymbol();
    const side   = Math.random() < 0.5 ? "BUY" : "SELL";
    const size   = LOOP.amount;

    const outcome = randomOutcome();
    const pnl     = calcPnlBinary(size, outcome);

    account.stats.orders += 1;
    if (outcome === "WIN") account.stats.win += 1;
    else if (outcome === "LOSE") account.stats.lose += 1;
    else account.stats.draw  += 1;

    account.stats.session_pnl = +(account.stats.session_pnl + pnl).toFixed(2);
    account.balance           = +(account.balance + pnl).toFixed(2);

    const t = {
      id: nextId++,
      ts: new Date().toISOString(),
      symbol, side, size,
      duration: RUNTIME.duration, // ใช้ duration ปัจจุบัน (1m/3m/5m)
      result: outcome,
      pnl,
      mgStep: Math.ceil(Math.random() * 4),
      strategy: "Random (assets selection)",
    };
    trades.unshift(t);
    if (trades.length > 10000) trades.pop();
    saveTrades();
    ssePushTrade(t);
  } catch (e) {
    console.error("tickTrade error:", e);
  }
}
function startLoop() { if (!loopTimer) loopTimer = setInterval(tickTrade, LOOP.tickMs); }
function stopLoop()  { if (loopTimer) { clearInterval(loopTimer); loopTimer = null; } }

// ----------------- app -----------------
const app = express();
app.use(express.json());
app.use(morgan("dev"));
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: false }));
app.options("*", cors()); // รองรับ preflight ทุกเส้นทาง

app.set("etag", false);
app.use((req,res,next) => {
  res.set("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma","no-cache");
  res.set("Expires","0");
  next();
});

// ---- health ----
app.get("/ping",   (req,res)=>res.json({ pong:true }));
app.get("/health", (req,res)=>res.json({ ok:true, service:"angelbot-mock", time:new Date().toISOString() }));

// ---- ENGINE (legacy compat) ----
app.get("/engine/status", (req,res)=>{
  res.json({
    ok: true,
    data: {
      running:   bot_state==="running",
      bot_state,
      connected: conn.is_connected,
      balance:   account.balance,
      account_type: conn.account_type,
      stats: account.stats,
      session_started_at: account.session_started_at,
      trades_count: trades.length,
      last_trade: trades[0] || null,
    }
  });
});

// optional connect/disconnect
app.post("/engine/connect", (_req,res)=>{ conn.is_connected = true;  res.json({ ok:true, connected:true }); });
app.post("/engine/disconnect", (_req,res)=>{ bot_state="stopped"; stopLoop(); conn.is_connected=false; res.json({ ok:true, connected:false, bot_state }); });

// === sync รายการสินทรัพย์จาก UI ===
function engineAssets(req,res){
  const { assets } = req.body || {};
  if (typeof assets === "string") {
    selectedAssets.clear();
    assets.split(",").map(s=>s.trim()).filter(Boolean)
      .forEach(s=>selectedAssets.add(s.toUpperCase()));
  }
  res.json({ ok:true, selected:[...selectedAssets] });
}
app.post("/engine/assets", engineAssets);

// === core handlers ===
function engineStart(req,res){
  if (!conn.is_connected) conn.is_connected = true; // auto-connect

  const b = req.body || {};
  if (b.assetsCsv) {
    selectedAssets.clear();
    String(b.assetsCsv).split(",").map(s=>s.trim()).filter(Boolean)
      .forEach(s=>selectedAssets.add(s.toUpperCase()));
  }
  if (b.intervalMs) LOOP.tickMs = Math.max(500, Number(b.intervalMs));
  if (b.amount)     LOOP.amount = Math.max(1,   Number(b.amount));

  const od = typeof b.orderDuration === "string" ? b.orderDuration.trim() : "";
  if (DUR_MAP[od]) RUNTIME.duration = DUR_MAP[od];

  bot_state = "running";
  if (!account.session_started_at) account.session_started_at = Date.now();
  startLoop();
  return res.json({
    ok:true,
    message:"bot-started",
    bot_state,
    selected:[...selectedAssets],
    tickMs:LOOP.tickMs,
    amount:LOOP.amount,
    duration:RUNTIME.duration
  });
}
function enginePause(_req,res){ bot_state="paused"; stopLoop(); return res.json({ ok:true, message:"bot-paused", bot_state }); }
function engineResume(_req,res){
  if (!conn.is_connected) conn.is_connected = true; // auto-connect
  bot_state = "running";
  startLoop();
  return res.json({ ok:true, message:"bot-resumed", bot_state });
}
function engineStop(_req,res){ bot_state="stopped"; stopLoop(); return res.json({ ok:true, message:"bot-stopped", bot_state }); }
function engineReset(_req,res){
  if (bot_state !== "stopped") return res.status(400).json({ ok:false, error:"must-stop-first" });
  trades = []; nextId = 1; saveTrades();
  return res.json({ ok:true, reset:true });
}

// bind /engine/*
app.post("/engine/start",  engineStart);
app.post("/engine/pause",  enginePause);
app.post("/engine/resume", engineResume);
app.post("/engine/stop",   engineStop);
app.post("/engine/reset-session", engineReset);

// manual signal (ignored in auto-loop)
app.post("/engine/signal", (_req,res)=> res.json({ ok:true, note:"auto-loop mode; manual signal ignored" }));

// list & csv
app.get("/engine/trades", (req,res)=>{
  const limit = Math.min(Math.max(Number(req.query.limit)||100, 1), 1000);
  res.json({ ok:true, trades: trades.slice(0,limit).map(fmtTradeForUI) });
});
app.get("/engine/trades.csv", (_req,res)=>{
  const header = ["id","timestamp","asset","direction","amount","mg_step","result","profit","strategy"];
  const rows = trades.map(t=>[
    t.id, t.ts, t.symbol, t.side==="BUY"?"CALL":"PUT",
    t.size.toFixed(2), t.mgStep??1, t.result??"", t.pnl.toFixed(2), t.strategy??""
  ]);
  const csv = [header.join(","), ...rows.map(r=>r.join(","))].join("\n");
  res.setHeader("Content-Type","text/csv; charset=utf-8");
  res.setHeader("Content-Disposition",'attachment; filename="trades.csv"');
  res.send(csv);
});

// SSE (legacy + ใหม่)
app.get("/engine/sse", (req,res)=>{
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders();
  sseSnapshot(res);
  sseClients.add(res);
  req.on("close", ()=>sseClients.delete(res));
});

// ---- UI รุ่นใหม่ ----
app.get("/state",  (_req,res)=> res.json({ ok:true, data: stateForUI() }));
app.get("/trades", (req,res)=>{
  const limit = Math.min(Math.max(Number(req.query.limit)||100, 1), 1000);
  res.json({ ok:true, data: trades.slice(0,limit).map(fmtTradeForUI) });
});
app.get("/trades/stream", (req,res)=>{
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders();
  sseSnapshot(res);
  sseClients.add(res);
  req.on("close", ()=>sseClients.delete(res));
});

// ---- /bot/* aliases (bind ตรง ไม่ใช้ _router.handle) ----
app.post("/bot/start",   engineStart);
app.post("/bot/pause",   enginePause);
app.post("/bot/resume",  engineResume);
app.post("/bot/stop",    engineStop);
app.post("/bot/reset",   engineReset);
app.post("/bot/assets",  engineAssets);

// ----------------- start -----------------
app.listen(PORT, ()=>{
  console.log(`✅ AngelBot server listening on http://127.0.0.1:${PORT}`);
});
