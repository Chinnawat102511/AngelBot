// server/session/routes.js  (ESM)
import express from "express";
import {
  initSessionStore,
  startSession,
  stopSession,
  resetSession,
  addNote,
  getSnapshot,
  getHistory,
} from "./model.js";

// โหลดสถานะจากดิสก์ครั้งแรก
await initSessionStore();

const r = express.Router();

/** รูทสั้น ๆ ดู snapshot ปัจจุบัน */
r.get("/", (_req, res) => {
  res.json({ ok: true, session: getSnapshot() });
});

/** เริ่ม session ใหม่ (ค่า equityStart / note เป็นออปชัน) */
r.post("/start", async (req, res) => {
  const { equityStart = null, note = null } = req.body || {};
  const s = await startSession({ equityStart, note });
  res.json({ ok: true, session: s });
});

/** หยุด session ปัจจุบัน (บันทึกโน้ตได้) */
r.post("/stop", async (req, res) => {
  const { note = null } = req.body || {};
  const s = await stopSession({ note });
  res.json({ ok: true, session: s });
});

/** รีเซ็ตค่าฝั่ง server (ล้างสถิติ, ใช้กับปุ่ม Reset Session PnL ฝั่ง UI) */
r.post("/reset", async (_req, res) => {
  const s = await resetSession();
  res.json({ ok: true, session: s });
});

/* ---------- Compatibility aliases (เพื่อไม่ให้ขึ้น 404 ใน Network) ---------- */

/** ปุ่ม Reset Session PnL ของหน้า Home เรียก /reset-session */
r.post("/reset-session", async (_req, res) => {
  const s = await resetSession();
  res.json({ ok: true, session: s });
});

/**
 * ปุ่ม Reset Life PnL ของหน้า Home ใช้การ “offset” ฝั่งไคลเอนต์เท่านั้น
 * endpoint นี้มีไว้ให้ 200 OK + บันทึกโน้ต เพื่อไม่ให้ Network แสดง 404
 */
r.post("/reset-life", async (_req, res) => {
  const s = await addNote("client: reset life pnl (offset)");
  res.json({ ok: true, session: s });
});

/** เพิ่มโน้ต (รองรับทั้งฟิลด์ note และ msg) */
r.post("/note", async (req, res) => {
  const payload = req.body || {};
  const msg = (payload.note ?? payload.msg ?? "").toString().trim();
  if (!msg) return res.status(400).json({ ok: false, error: "empty_msg" });
  const s = await addNote(msg);
  res.json({ ok: true, session: s });
});

/** ประวัติ (jsonl ของวันนี้) */
r.get("/history", async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const rows = await getHistory(Number.isFinite(limit) ? limit : 100);
  res.json({ ok: true, rows });
});

/** สถานะ (alias เผื่อใช้งานตรงจาก /session/status) */
r.get("/status", (_req, res) => {
  const s = getSnapshot();
  res.json({ ok: true, connected: true, running: s.running, session: s });
});

export default r;
