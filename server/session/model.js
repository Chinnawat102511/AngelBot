// server/session/model.js  (ESM)

import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR   = path.resolve(__dirname, "data");
const STATE_PATH = path.join(DATA_DIR, "session.json");
const LOG_DIR    = path.join(DATA_DIR, "sessions");

// ensure dirs
await fsp.mkdir(DATA_DIR, { recursive: true });
await fsp.mkdir(LOG_DIR,  { recursive: true });

/**
 * โครงสร้างสถานะพื้นฐาน
 * - lifePnl: สะสมทั้งชีวิต (รีเซ็ตได้ด้วย resetLife)
 * - pnl:     ของเซสชันปัจจุบัน (รีเซ็ตด้วย resetSession หรือ startSession ใหม่)
 */
const freshState = () => ({
  running: false,
  connected: true,

  // time marks
  startedAt: null,          // เวลาเริ่มเซสชันล่าสุด
  lastActionAt: null,

  // session KPIs
  orders: 0,
  w: 0, l: 0, d: 0,
  pnl: 0,                   // session pnl
  maxMG: 0,
  step: 0,
  payout: 0,
  maxStake: 0,

  // equity metrics
  equityStart: null,
  equityNow:   null,
  maxDD: 0,

  // life KPIs
  lifePnl: 0,

  // misc
  notes: [],                // [{ts, note|type, ...}]
});

let state = freshState();

/* ---------- persistence ---------- */
async function load() {
  try {
    const raw = await fsp.readFile(STATE_PATH, "utf8");
    const saved = JSON.parse(raw);

    // merge ให้มี key ใหม่ครบ
    state = { ...freshState(), ...saved };
  } catch {
    // nothing
  }
}
async function save() {
  state.lastActionAt = new Date().toISOString();
  await fsp.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}
function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

/* ---------- logging ---------- */
async function appendLog(event, payload = {}) {
  const day  = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${day}.jsonl`);
  const row  = { ts: new Date().toISOString(), event, ...payload };
  await fsp.appendFile(file, JSON.stringify(row) + "\n", "utf8");
}

/* ---------- public API ---------- */
export async function initSessionStore() {
  await load();
}

/** ปรับสถานะการเชื่อมต่อ (เผื่อ compat layer ใช้) */
export async function setConnected(v) {
  state.connected = !!v;
  await save();
  return snapshot();
}

export async function startSession({ equityStart = null, note = null } = {}) {
  // ไม่รีเซ็ต lifePnl เมื่อ start ใหม่
  state.running   = true;
  state.orders    = 0; state.w = 0; state.l = 0; state.d = 0;
  state.pnl       = 0;
  state.maxMG     = 0;
  state.step      = 0;
  state.payout    = 0;
  state.maxStake  = 0;

  state.startedAt   = new Date().toISOString();
  state.equityStart = equityStart;
  state.equityNow   = equityStart;

  if (note) state.notes.unshift({ ts: new Date().toISOString(), type: "start", note });

  await appendLog("start", { equityStart, note });
  await save();
  return snapshot();
}

export async function stopSession({ note = null } = {}) {
  state.running = false;
  if (note) state.notes.unshift({ ts: new Date().toISOString(), type: "stop", note });
  await appendLog("stop", { note });
  await save();
  return snapshot();
}

/** รีเซ็ตเฉพาะ “เซสชัน” — ไม่แตะ lifePnl */
export async function resetSession({ note = null } = {}) {
  state.orders = 0; state.w = 0; state.l = 0; state.d = 0;
  state.pnl    = 0;
  state.maxMG  = 0;
  state.step   = 0;
  state.payout = 0;
  state.maxStake = 0;

  // เริ่มรอบใหม่
  state.startedAt = new Date().toISOString();

  if (note) state.notes.unshift({ ts: new Date().toISOString(), type: "reset-session", note });
  await appendLog("reset-session", { note });
  await save();
  return snapshot();
}

/** รีเซ็ตเฉพาะ “Life PnL” */
export async function resetLife({ note = null } = {}) {
  state.lifePnl = 0;
  if (note) state.notes.unshift({ ts: new Date().toISOString(), type: "reset-life", note });
  await appendLog("reset-life", { note });
  await save();
  return snapshot();
}

export async function addNote(note) {
  state.notes.unshift({ ts: new Date().toISOString(), type: "note", note });
  await appendLog("note", { note });
  await save();
  return snapshot();
}

/**
 * อัปเดตจากผลเทรดหนึ่งไม้
 * @param {{result: 'WIN'|'LOSS'|'DRAW', pnl?: number, step?:number, maxMG?:number, stake?:number, payout?:number, equity?:number}} p
 */
export async function onTrade({ result, pnl = 0, step = 0, maxMG = 0, stake = 0, payout = 0, equity = null }) {
  state.orders++;

  if (String(result).toUpperCase() === "WIN") state.w++;
  else if (String(result).toUpperCase() === "LOSS") state.l++;
  else state.d++;

  const dpnl = Number(pnl || 0);
  state.pnl     += dpnl;
  state.lifePnl += dpnl;

  state.step     = Math.max(state.step, Number(step || 0));
  state.maxMG    = Math.max(state.maxMG, Number(maxMG || 0));
  state.maxStake = Math.max(state.maxStake, Number(stake || 0));
  state.payout   = Number(payout || state.payout || 0);

  // equity / maxDD (คำนวณแบบง่าย ๆ)
  if (equity != null) {
    const nowEq = Number(equity);
    if (Number.isFinite(nowEq)) {
      if (state.equityStart == null) state.equityStart = nowEq;
      state.equityNow = nowEq;
      const dd = state.equityStart != null ? state.equityStart - nowEq : 0;
      state.maxDD = Math.max(state.maxDD || 0, dd || 0);
    }
  }

  await appendLog("trade", { result, pnl: dpnl, step, maxMG, stake, payout, equity });
  await save();
  return snapshot();
}

export function getSnapshot() {
  return snapshot();
}

export async function getHistory(limit = 100) {
  const day  = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${day}.jsonl`);
  try {
    const raw  = await fsp.readFile(file, "utf8");
    const rows = raw
      .trim()
      .split("\n")
      .slice(-limit)
      .map((l) => JSON.parse(l));
    return rows;
  } catch {
    return [];
  }
}
