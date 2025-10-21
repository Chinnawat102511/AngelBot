// --- Node core ---
const fs   = require("fs");
const path = require("path");

// --- Server deps ---
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");

// --- Paths ---
const DATA_DIR    = path.join(__dirname, "logs");
const TRADES_FILE = path.join(DATA_DIR, "trades.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- In-memory state ---
let state = {
  connected: true,
  status: "stopped", // "running" | "paused" | "stopped"
  accountType: "PRACTICE",
  balance: 10000,
  trades: [],
  stats: { win: 0, lose: 0, draw: 0, total: 0 }
};

// --- Utils ---
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const outcome = () => (Math.random() < 0.52 ? "WIN" : Math.random() < 0.92 ? "LOSE" : "EQUAL");
const pnlOf = (amt, res) => res==="WIN"? +(amt*0.87).toFixed(2) : res==="LOSE" ? -amt : 0;
const nowMs = () => Date.now();

// --- App ---
const app = express();
app.use(express.json());
app.use(morgan("dev"));
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: false }));

const PORT = Number(process.env.PORT) || 3001;

// ---- Health ----
app.get("/health", (req, res) => res.json({ ok:true, service:"angelbot-mock", time:new Date().toISOString() }));

// ---- Status ----
app.get("/engine/status", (req, res) => {
  res.json({ ok:true, data: {
    running: state.status === "running",
    connected: state.connected,
    accountType: state.accountType,
    balance: state.balance,
    stats: state.stats,
    trades_count: state.trades.length,
    last_trade: state.trades[0] || null,
    status: state.status,
  }});
});

// ---- Controls ----
app.post("/engine/start", (req, res) => {
  state.status = "running";
  res.json({ ok:true, data: { status: state.status, connected: state.connected, accountType: state.accountType } });
});
app.post("/engine/stop", (req, res) => {
  state.status = "stopped";
  res.json({ ok:true, data: { status: state.status, connected: state.connected, accountType: state.accountType } });
});
app.post("/engine/pause", (req, res) => {
  if (state.status === "running") state.status = "paused";
  res.json({ ok:true, data: { status: state.status, connected: state.connected, accountType: state.accountType } });
});
app.post("/engine/resume", (req, res) => {
  if (state.status !== "stopped") state.status = "running";
  res.json({ ok:true, data: { status: state.status, connected: state.connected, accountType: state.accountType } });
});
app.post("/engine/reset-session", (req, res) => {
  state.trades = [];
  state.stats = { win:0, lose:0, draw:0, total:0 };
  res.json({ ok:true, data: true });
});

// ---- Place mock trade (optional manual trigger) ----
app.post("/engine/signal", async (req, res) => {
  const { symbol="XAUUSD", side="BUY", size=10 } = req.body || {};
  if (state.status !== "running") return res.status(400).json({ ok:false, error:"not-running" });

  await delay(400);
  const result = outcome();
  const trade = {
    id: nowMs(),
    timestamp: nowMs(),
    asset: String(symbol).toUpperCase(),
    direction: side === "BUY" ? "CALL" : "PUT",
    amount: Number(size),
    mgStep: Math.ceil(Math.random()*4),
    duration: "1m",
    result,
    result_pl: pnlOf(Number(size), result),
    strategy: "AI Model (1m)"
  };

  state.trades.unshift(trade);
  state.stats.total++;
  if (result==="WIN") state.stats.win++; else if (result==="LOSE") state.stats.lose++; else state.stats.draw++;
  state.balance = +(state.balance + trade.result_pl).toFixed(2);

  // broadcast to SSE clients
  for (const res of clients) {
    try { res.write(`event: trade\ndata: ${JSON.stringify(trade)}\n\n`); } catch {}
  }

  res.json({ ok:true, data: trade });
});

// ---- Trades ----
app.get("/engine/trades", (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit)||100, 1), 1000);
  res.json({ ok:true, data: state.trades.slice(0, limit) });
});
app.get("/engine/trades.csv", (req, res) => {
  const csv = [
    "id,timestamp,asset,direction,amount,mg_step,result,profit,strategy",
    ...state.trades.map(t => [
      t.id, new Date(t.timestamp).toISOString(), t.asset, t.direction,
      t.amount.toFixed(2), t.mgStep, t.result, t.result_pl.toFixed(2), t.strategy
    ].join(","))
  ].join("\n");
  res.setHeader("Content-Type","text/csv; charset=utf-8");
  res.setHeader("Content-Disposition",'attachment; filename="trades.csv"');
  res.send(csv);
});

// ---- SSE ----
const clients = new Set();
app.get("/engine/sse", (req, res) => {
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders();

  // ส่ง snapshot ตอนเชื่อมต่อ
  res.write(`event: snapshot\ndata: ${JSON.stringify(state.trades.slice(0, 200))}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`✅ AngelBot mock listening on http://127.0.0.1:${PORT}`);
});
