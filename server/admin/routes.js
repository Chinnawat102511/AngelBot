// ESM: C:\AngelBot\server\admin\routes.js
import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requireAdmin, login, logout, me } from "./auth.js";
import { issueLicenseJson } from "../core/license-issue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/* ---------- middlewares (เฉพาะกลุ่ม /admin) ---------- */
router.use(cookieParser());
router.use(express.json());

// rate limit พื้นฐาน
router.use(rateLimit({
  windowMs: 10 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
}));

// บังคับ content-type application/json เฉพาะเมธอดที่มี body
function requireJson(req, res, next) {
  if (["GET", "HEAD", "DELETE"].includes(req.method)) return next();
  if (req.is("application/json")) return next();
  return res.status(415).json({ error: "unsupported_content_type" });
}
router.use(requireJson);

// helper ครอบ async
const asyncWrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- auth ---------- */
// /admin/login — ใช้ตัว login จาก auth.js (แยก 400/401 ถูกต้องอยู่แล้ว)
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
router.post("/login", loginLimiter, asyncWrap(login));

// /admin/logout รองรับทั้ง POST/GET
router.post("/logout", asyncWrap(logout));
router.get ("/logout",  asyncWrap(logout));

// /admin/me ต้องผ่าน requireAdmin
router.get("/me", requireAdmin, asyncWrap(me));

/* ---------- License issuing (admin only / เผื่อ UI ใช้) ----------
   หมายเหตุ: เซิร์ฟเวอร์หลักมี /api/license/generate อยู่แล้ว
   endpoint นี้เป็น alias ใต้ /admin คงไว้เพื่อความยืดหยุ่น
------------------------------------------------------------------*/
const issueLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post("/license/issue", requireAdmin, issueLimiter, asyncWrap(async (req, res) => {
  const { owner = "AngelTeam", days, plan = "pro", meta, expires } = req.body || {};
  const bad = (message) => res.status(400).json({ ok: false, error: "bad_request", message });

  if (typeof owner !== "string" || owner.trim().length < 1 || owner.length > 64) return bad("invalid owner");
  const allowPlans = new Set(["pro", "basic", "trial"]);
  if (!allowPlans.has(plan)) return bad("invalid plan");

  let dInt, expStr;
  if (typeof days !== "undefined") {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 365) return bad("days must be integer 1..365");
    dInt = n;
  } else if (typeof expires !== "undefined") {
    if (typeof expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return bad("expires must be YYYY-MM-DD");
    expStr = expires;
  } else {
    dInt = 30;
  }

  if (typeof meta !== "undefined" && (typeof meta !== "object" || meta === null || Array.isArray(meta))) {
    return bad("meta must be object");
  }

  const lic = issueLicenseJson({ owner, days: dInt, plan, meta, expires: expStr });

  // audit log
  const logDir = path.join(__dirname, "..", "logs");
  await fs.mkdir(logDir, { recursive: true });
  const line = `[${new Date().toISOString()}] issue by ${req.admin?.u || "-"} -> ${lic.id}\n`;
  await fs.appendFile(path.join(logDir, "admin.log"), line, "utf8");

  res.json({ ok: true, license: lic });
}));

/* ---------- error handler เฉพาะกลุ่ม /admin ---------- */
router.use((err, _req, res, _next) => {
  console.error("[admin routes error]", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

export default router;
