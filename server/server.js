/* ── 0) Load .env ให้เร็วที่สุด ───────────────────────── */
import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, ".env") });

/* ── 1) 3rd-party & Node built-ins ─────────────────────── */
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import multer from "multer";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import http from "http";                          // ★ เพิ่ม
import { WebSocketServer } from "ws";            // ★ เพิ่ม

/* ── 2) project modules ─────────────────────────────────── */
import { issueLicenseJson } from "./core/license-issue.js";
import sessionRoutes from "./session/routes.js";
import { getSnapshot as getSessionSnap } from "./session/model.js";
import adminRoutes from "./admin/routes.js";
import { requireAdmin } from "./admin/auth.js";

/* ── 3) helpers + ENV ───────────────────────────────────── */
const toBool = (v) => String(v ?? "").trim().toLowerCase() === "true";
const toInt  = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const splitCsv = (s = "") => String(s).split(",").map(x => x.trim()).filter(Boolean);

const HOST = process.env.HOST || "0.0.0.0";
const PORT = toInt(process.env.PORT ?? process.env.LICENSE_PORT, 3001);

const RAW_ORIGINS = splitCsv(process.env.ALLOW_ORIGIN ?? "*");
const CORS_WILDCARD   = RAW_ORIGINS.length === 1 && RAW_ORIGINS[0] === "*";
const CORS_ORIGIN     = CORS_WILDCARD ? "*" : RAW_ORIGINS.map(o => o.replace(/\/+$/, ""));
const CORS_CREDENTIAL = !CORS_WILDCARD;

const ENFORCE          = toBool(process.env.LICENSE_ENFORCE ?? "true");
const REQUIRE_CHECKSUM = toBool(process.env.LICENSE_REQUIRE_CHECKSUM ?? "false");

const RENEW_DAYS_DEFAULT = 7;
const getRenewDays = () => {
  const v = Number(process.env.LICENSE_RENEW_THRESHOLD_DAYS ?? process.env.RENEW_THRESHOLD_DAYS ?? RENEW_DAYS_DEFAULT);
  return Number.isFinite(v) && v > 0 ? v : RENEW_DAYS_DEFAULT;
};

// ตำแหน่งโฟลเดอร์ license
const LICENSE_DIR = process.env.LICENSE_DIR
  ? path.resolve(process.cwd(), process.env.LICENSE_DIR)
  : path.join(__dirname, "licenses");
await fsp.mkdir(LICENSE_DIR, { recursive: true });

console.log("[env] ADMIN_PASS_HASH set?", !!process.env.ADMIN_PASS_HASH);
console.log("[env] PORT=%s HOST=%s ORIGINS=%o", PORT, HOST, CORS_ORIGIN);
console.log("[env] LICENSE_DIR=%s", LICENSE_DIR);

/* ── 4) App ─────────────────────────────────────────────── */
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: CORS_ORIGIN, credentials: CORS_CREDENTIAL }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

// no-cache helper
const noCache = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};

/* ── 5) small utils ─────────────────────────────────────── */
async function getLatestLicenseFile() {
  const files = await fsp.readdir(LICENSE_DIR);
  const jsons = files.filter(f => f.endsWith(".json"));
  if (jsons.length === 0) return null;
  const withTime = await Promise.all(jsons.map(async (f) => {
    const st = await fsp.stat(path.join(LICENSE_DIR, f));
    return { f, t: st.mtimeMs };
  }));
  return withTime.sort((a,b) => b.t - a.t)[0].f;
}

/** อ่าน JSON รองรับ BOM */
async function readJsonFile(absPath) {
  const raw = await fsp.readFile(absPath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function daysLeft(iso) {
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return NaN;
  return Math.ceil((end - Date.now()) / (24*3600*1000));
}

function verifyChecksum(license) {
  if (!REQUIRE_CHECKSUM) return { ok: true,  reason: "skip_checksum" };
  if (typeof license?.checksum !== "string" || license.checksum.length < 8) {
    return { ok: false, reason: "missing_checksum" };
  }
  return { ok: true, reason: "present_only" };
}

/* ── 6) Debug helper (dev) ──────────────────────────────── */
app.get("/debug/licenses", async (_req, res) => {
  try {
    const files = await fsp.readdir(LICENSE_DIR);
    res.json({ dir: LICENSE_DIR, files });
  } catch (e) {
    res.status(500).json({ dir: LICENSE_DIR, error: String(e) });
  }
});

/* ── 7) Admin & Auth ────────────────────────────────────── */
app.use("/admin", adminRoutes);

/* แผงสรุป admin */
app.get("/admin/summary", requireAdmin, async (_req, res) => {
  try {
    const latest = await getLatestLicenseFile();
    let verify = null;

    if (latest) {
      try {
        const json = await readJsonFile(path.join(LICENSE_DIR, latest));
        const left = daysLeft(json.valid_until);
        const checksum = verifyChecksum(json);
        const renewDays = getRenewDays();

        let status = "valid";
        if (!checksum.ok)               status = "invalid_checksum";
        else if (!Number.isFinite(left)) status = "invalid_date";
        else if (left < 0)              status = "expired";
        else if (left <= renewDays)     status = "expiring";

        verify = {
          ok: status === "valid" || status === "expiring",
          status, days_left: left,
          enforce: ENFORCE, require_checksum: REQUIRE_CHECKSUM,
          file: latest, owner: json.owner, plan: json.plan,
          valid_until: json.valid_until, reason: checksum.reason ?? null,
        };
      } catch (e) {
        verify = { ok: false, status: "bad_license_json", reason: String(e?.message || e) };
      }
    }

    res.json({
      ok: true,
      latest_file: latest || null,
      verify,
      now: new Date().toISOString(),
      enforce: ENFORCE,
      require_checksum: REQUIRE_CHECKSUM,
      allow_origin: CORS_ORIGIN,
    });
  } catch (e) {
    console.error("[admin summary error]", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ── 8) MG & Session ───────────────────────────────────── */
import mgRoutes from "./mg/routes.js";
app.use("/mg", mgRoutes);
app.use("/api/mg", mgRoutes);

app.use("/session", sessionRoutes);
app.use("/api/session", sessionRoutes);

// Status endpoint — alias ให้ทั้ง /status และ /api/status (no-cache)
const statusRoute = (_req, res) => {
  const s = getSessionSnap();
  res.json({ ok: true, connected: true, running: s.running, session: s });
};
app.get("/status",  noCache, statusRoute);
app.get("/api/status", noCache, statusRoute);

/* ── 9) Health / Ping ───────────────────────────────────── */
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get("/api/forecast/ping", noCache, (_req, res) =>
  res.json({ ok: true, pong: true, ts: Date.now() })
);

/* ── 10) License endpoints ──────────────────────────────── */
// latest
app.get("/api/license/latest", noCache, async (_req, res) => {
  try {
    const latest = await getLatestLicenseFile();
    if (!latest) return res.status(404).json({ error: "no_license" });
    res.sendFile(path.join(LICENSE_DIR, latest));
  } catch (err) {
    console.error("[latest license error]", err);
    res.status(500).json({ error: "internal_error" });
  }
});

// verify (GET/POST)
async function handleVerify(_req, res) {
  try {
    const latest = await getLatestLicenseFile();
    if (!latest) return res.status(404).json({ ok: false, status: "missing", enforce: ENFORCE });

    let json;
    try {
      json = await readJsonFile(path.join(LICENSE_DIR, latest));
    } catch (e) {
      console.error("[verify] JSON parse error:", e);
      return res.status(400).json({ ok: false, status: "bad_license_json" });
    }

    const renewDays = getRenewDays();
    const left = daysLeft(json.valid_until);
    if (!Number.isFinite(left)) {
      console.error("[verify] invalid valid_until:", json.valid_until);
      return res.status(400).json({ ok: false, status: "invalid_date" });
    }

    const checksum = verifyChecksum(json);

    let status = "valid";
    if (!checksum.ok)            status = "invalid_checksum";
    else if (left < 0)           status = "expired";
    else if (left <= renewDays)  status = "expiring";

    res.json({
      ok: status === "valid" || status === "expiring",
      status,
      days_left: left,
      enforce: ENFORCE,
      require_checksum: REQUIRE_CHECKSUM,
      file: latest,
      owner: json.owner,
      plan: json.plan,
      valid_until: json.valid_until,
      reason: checksum.reason ?? null,
    });
  } catch (err) {
    console.error("[verify license error]", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}
app.get ("/api/license/verify",  noCache, handleVerify);
app.post("/api/license/verify",  noCache, handleVerify);

// generate (dev) — ป้องกันด้วย admin
const upload = multer({ storage: multer.memoryStorage() });
async function handleGenerate(req, res) {
  try {
    const src = { ...(req.query || {}), ...(req.body || {}) };
    const owner = String(src.owner || process.env.LICENSE_OWNER || "AngelTeam");
    const plan  = String(src.plan  || process.env.LICENSE_PLAN  || "pro");
    let days = src.days ? parseInt(String(src.days), 10) : 30;
    if (!Number.isInteger(days) || days < 1 || days > 365) days = 30;

    const lic = issueLicenseJson({ owner, plan, days });
    const filename = `${lic.id}.json`;
    await fsp.writeFile(path.join(LICENSE_DIR, filename), JSON.stringify(lic, null, 2), "utf8");
    res.json({ ok: true, license: lic, file: filename });
  } catch (err) {
    console.error("[generate license error]", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}
app.get ("/api/license/generate", requireAdmin, handleGenerate);
app.post("/api/license/generate", requireAdmin, handleGenerate);

// upload (multipart/json) — ป้องกันด้วย admin
app.post("/api/license/upload", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    let licObj;
    if (req.file) licObj = JSON.parse(req.file.buffer.toString("utf8"));
    else if (req.is("application/json")) licObj = req.body;
    else licObj = null;

    if (!licObj || typeof licObj !== "object") {
      return res.status(400).json({ ok: false, error: "bad_payload" });
    }
    if (!licObj.id) licObj.id = crypto.randomUUID();

    const filename = `${licObj.id}.json`;
    await fsp.writeFile(path.join(LICENSE_DIR, filename), JSON.stringify(licObj, null, 2), "utf8");
    res.json({ ok: true, file: filename, license: licObj });
  } catch (err) {
    console.error("[upload license error]", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/* ── 11) Rate limit ทั้งเซิร์ฟเวอร์ ─────────────────────── */
app.use(rateLimit({
  windowMs: Number(process.env.RATE_WINDOW_MS ?? 60_000),
  max: Number(process.env.RATE_MAX ?? 300),
  standardHeaders: true,
  legacyHeaders: false,
}));

/* ── 12) Compatibility Layer (CJS) ──────────────────────── */
try {
  const compatMod = await import("./compatRoutes.cjs");
  const attachCompat = compatMod.default || compatMod;
  await fsp.mkdir(LICENSE_DIR, { recursive: true });
  attachCompat(app, { licenseDir: LICENSE_DIR });
  console.log("[compat] enabled: /status, /license/check, /connect, /bot/*, /trades*, /indicators*, /market-hours, /system/*");
} catch (e) {
  console.error("[compat] failed]", e?.message || e);
}

// ===== WS helpers (ถ้ามีอยู่แล้วให้ข้าม) =====
function broadcast(obj) {
  const data = JSON.stringify(obj);
  if (globalThis._wss) {
    globalThis._wss.clients.forEach((c) => { if (c.readyState === 1) c.send(data); });
  }
}

// ===== dev broadcast endpoint =====
app.post('/api/dev/broadcast', (req, res) => {
  const { type = 'dev:message', payload = {} } = req.body || {};
  broadcast({ type, payload, ts: Date.now() });
  res.json({ ok: true });
});

/* ── X) Compat endpoints for old UI ─────────────────────── */

// แทน /api/license/status?path=... → ใช้ logic เดียวกับ verify
app.get('/api/license/status', noCache, handleVerify);

// แทน /api/ping → ใช้ health/forecast ping เดิม
app.get('/api/ping', noCache, (_req, res) =>
  res.json({ ok: true, pong: true, ts: Date.now() })
);

// แทน /api/license/gen → map ไป generate ของจริง
app.post('/api/license/gen', requireAdmin, handleGenerate);
console.log('[compat-ui] routes enabled: /api/ping, /api/license/status, /api/license/gen');

/* ── 13) Not Found + Error Handler ─────────────────────── */
app.use((req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error("[unhandled error]", err);
  res.status(500).json({ error: "internal_error" });
});

/* ── 14) HTTP server + WebSocket (แชร์พอร์ตเดียวกัน) ──── */
// ★ แทนที่ app.listen(...) ด้วยบล็อคนี้
const server = http.createServer(app);

// WS บน path /ws
const wss = new WebSocketServer({ server, path: '/ws' });
globalThis._wss = wss; // <— ใส่บรรทัดนี้ครั้งเดียวพอ


// heartbeat
function heartbeat() { this.isAlive = true; }
wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  // hello on connect
  ws.send(JSON.stringify({
    type: "server:hello",
    payload: { ip: req.socket.remoteAddress },
    ts: Date.now()
  }));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg?.type === "client:ping") {
        ws.send(JSON.stringify({ type: "server:pong", payload: { ok: true }, ts: Date.now() }));
      }
    } catch {}
  });
});


// ===== dev broadcast endpoint =====
app.post('/api/dev/broadcast', (req, res) => {
  const { type = 'dev:message', payload = {} } = req.body || {};
  broadcast({ type, payload, ts: Date.now() });
  res.json({ ok: true });
});

// (ออปชัน) auto tick
// setInterval(() => broadcast({ type: "tick", payload: { note: "hb" }, ts: Date.now() }), 20_000);

// start both on same port
server.listen(PORT, HOST, () => {
  console.log(`License server + WS on http://${HOST}:${PORT}`);
});

/* ── 15) Safety hooks ───────────────────────────────────── */
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));
process.on("SIGINT",  () => { console.log("\n[server] SIGINT  -> shutdown"); process.exit(0); });
process.on("SIGTERM", () => { console.log("\n[server] SIGTERM -> shutdown"); process.exit(0); });
