// Minimal AngelBot server (mock) — port 3001
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

let botState = {
  status: "stopped",       // running | paused | stopped
  connected: false,
  accountType: "PRACTICE",
  baseEquity: 1000,
  realizedPL: 0,
  equityLive: 1000,
};

let trades = [];
let sseClients = new Set();
let ticker = null;

// helpers
function pushTrade(t) {
  trades.unshift(t);
  // update PL
  botState.realizedPL += (t.result_pl || 0);
  botState.equityLive = botState.baseEquity + botState.realizedPL;
  // notify SSE clients
  const msg = `event: trade\ndata: ${JSON.stringify(t)}\n\n`;
  for (const res of sseClients) res.write(msg);
}
function randomTrade() {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2,6)}`;
  const assets = ["XAUUSD", "EURUSD"];
  const asset = assets[Math.floor(Math.random()*assets.length)];
  const dir = Math.random() > 0.5 ? "CALL" : "PUT";
  const resu = Math.random() < 0.45 ? "WIN" : (Math.random() < 0.5 ? "LOSE" : "EQUAL");
  const pl = resu === "WIN" ? +8 : resu === "LOSE" ? -10 : 0;
  return {
    id,
    timestamp: new Date().toISOString(),
    asset,
    direction: dir,
    amount: 10,
    mgStep: 0,
    duration: "1m",
    result: resu,
    result_pl: pl,
    strategy: "Baseline",
  };
}

// routes
app.get("/api/ping", (_req, res) => res.json({ pong: true }));

app.get("/api/state", (_req, res) => {
  res.json({ ok: true, data: botState });
});

app.get("/api/trades", (_req, res) => {
  res.json({ ok: true, data: trades });
});

app.post("/api/bot/start", (req, res) => {
  const { conn, cfg } = req.body || {};
  botState.connected = true;
  botState.accountType = conn?.accountType || "PRACTICE";
  botState.status = "running";
  if (cfg?.baseEquityInput) {
    botState.baseEquity = Number(cfg.baseEquityInput);
    botState.realizedPL = 0;
    botState.equityLive = botState.baseEquity;
  }
  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => pushTrade(randomTrade()), 2000); // ยิงเทรดเดโม่ทุก 2 วิ
  res.json({ ok: true, data: botState });
});

app.post("/api/bot/pause", (_req, res) => {
  botState.status = "paused";
  if (ticker) { clearInterval(ticker); ticker = null; }
  res.json({ ok: true, data: botState });
});

app.post("/api/bot/resume", (_req, res) => {
  if (botState.connected) {
    botState.status = "running";
    if (!ticker) ticker = setInterval(() => pushTrade(randomTrade()), 2000);
    return res.json({ ok: true, data: botState });
  }
  res.json({ ok: false, error: "Not connected" });
});

app.post("/api/bot/stop", (_req, res) => {
  botState.status = "stopped";
  if (ticker) { clearInterval(ticker); ticker = null; }
  res.json({ ok: true, data: botState });
});

app.post("/api/bot/reset", (_req, res) => {
  trades = [];
  botState.realizedPL = 0;
  botState.equityLive = botState.baseEquity;
  // snapshot ให้ UI
  const snap = `event: snapshot\ndata: ${JSON.stringify(trades)}\n\n`;
  for (const c of sseClients) c.write(snap);
  res.json({ ok: true, data: true });
});

// SSE stream
app.get("/api/trades/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "http://localhost:5173",
  });
  sseClients.add(res);
  // ส่ง snapshot แรก
  res.write(`event: snapshot\ndata: ${JSON.stringify(trades)}\n\n`);
  req.on("close", () => sseClients.delete(res));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("AngelBot server running on", PORT));
