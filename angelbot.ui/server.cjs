// server.js  (AngelBot UI — License Server)
// Default single-file mode (Absolute Path: แบบ B)
// ค่าเริ่มต้นจะชี้ไปยังไฟล์เดียว: C:\AngelBot\angelbot.ui\licenses\license_output_1d.json
// หมายเหตุ: สามารถส่ง ?path=<absolute.json> เพื่อ override ชั่วคราวได้เช่นกัน

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ====== CONFIG (Absolute Path แบบ B) ======
const DEFAULT_LICENSE_PATH =
  process.env.DEFAULT_LICENSE_PATH ||
  'C:\\AngelBot\\angelbot.ui\\licenses\\license_output_1d.json';

// ====== Helpers ======
function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function now() { return new Date(); }
function toISO(d) { return new Date(d).toISOString(); }
function readJsonSafe(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}
function writeJson(p, obj) {
  ensureDirFor(p);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}
function calcDaysLeft(expireAt) {
  const ms = new Date(expireAt).getTime() - now().getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
function checkLicense(lic) {
  if (!lic || typeof lic !== 'object') {
    return { isValid: false, reason: 'NO_LICENSE' };
  }
  if (!lic.expireAt) {
    return { isValid: false, reason: 'MISSING_EXPIRE' };
  }
  const exp = new Date(lic.expireAt);
  if (Number.isNaN(exp.getTime())) {
    return { isValid: false, reason: 'INVALID_EXPIRE' };
  }
  if (exp.getTime() <= now().getTime()) {
    return { isValid: false, reason: 'EXPIRED', daysLeft: 0, expireAt: lic.expireAt };
  }
  return { isValid: true, reason: 'OK', daysLeft: calcDaysLeft(lic.expireAt), expireAt: lic.expireAt };
}
function resolvePathFrom(req) {
  // อนุญาต override ชั่วคราวผ่าน ?path=... (หรือ body.path สำหรับ /gen)
  const p = req.query?.path || req.body?.path || DEFAULT_LICENSE_PATH;
  // validation ขั้นพื้นฐาน: ลงท้าย .json และมีรูปแบบไดรฟ์ เช่น C:\
  if (!/^[A-Za-z]:\\/.test(p) || !p.toLowerCase().endsWith('.json')) {
    return null;
  }
  return p;
}

// ====== Routes ======
app.get('/api/ping', (_req, res) => {
  res.json({
    ok: true,
    pong: true,
    service: 'license-forecast',
    defaultPath: DEFAULT_LICENSE_PATH
  });
});

// POST /api/license/gen  { name?: string, days?: number, path?: string }
app.post('/api/license/gen', (req, res) => {
  const filePath = resolvePathFrom(req);
  if (!filePath) return res.status(400).json({ ok: false, error: 'INVALID_PATH' });

  try {
    const name = req.body?.name ?? 'AngelTeam';
    const days = Number(req.body?.days ?? 30);

    const issuedAt = now();
    const expireAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);

    const license = {
      ok: true,
      holder: name,
      ttlDays: days,
      issuedAt: toISO(issuedAt),
      expireAt: toISO(expireAt),
      service: 'license-forecast',
      base: 'http://localhost:3001',
      path: filePath,
      pong: true
    };

    writeJson(filePath, license);

    const check = checkLicense(license);
    return res.json({
      ok: true,
      message: 'LICENSE_GENERATED',
      path: filePath,
      license,
      isValid: check.isValid,
      reason: check.reason,
      daysLeft: check.daysLeft ?? 0,
      expireAt: check.expireAt ?? null
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// Upload license.json → เขียนทับที่ path เดียวกัน
const upload = multer({ dest: path.join(process.cwd(), 'data', 'uploads') });
app.post('/api/license/upload', upload.single('file'), (req, res) => {
  const filePath = resolvePathFrom(req);
  if (!filePath) return res.status(400).json({ ok: false, error: 'INVALID_PATH' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'NO_FILE' });

  try {
    const raw = fs.readFileSync(req.file.path, 'utf8');
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch {}
    if (!parsed || !parsed.expireAt) {
      parsed = Object.assign({}, parsed || {}, { ok: false, reason: 'UPLOADED_NO_EXPIRE', expireAt: null });
    }
    writeJson(filePath, parsed);
    fs.unlink(req.file.path, () => {});

    const check = checkLicense(parsed);
    return res.json({
      ok: true,
      saved: true,
      path: filePath,
      license: parsed,
      isValid: check.isValid,
      reason: check.reason,
      daysLeft: check.daysLeft ?? 0,
      expireAt: check.expireAt ?? null
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// GET /api/license/status  (?path=... optional)
app.get('/api/license/status', (_req, res) => {
  const filePath = resolvePathFrom(_req);
  if (!filePath) return res.status(400).json({ ok: false, error: 'INVALID_PATH' });

  const lic = readJsonSafe(filePath);
  const check = checkLicense(lic);
  return res.json({
    ok: true,
    path: filePath,
    isValid: !!check.isValid,
    reason: check.reason,
    daysLeft: check.daysLeft ?? 0,
    expireAt: check.expireAt ?? null,
    license: lic,
    base: 'http://localhost:3001'
  });
});

// GET /api/license/verify  (?path=... optional)
app.get('/api/license/verify', (_req, res) => {
  const filePath = resolvePathFrom(_req);
  if (!filePath) return res.status(400).json({ ok: false, error: 'INVALID_PATH' });

  const lic = readJsonSafe(filePath);
  const check = checkLicense(lic);
  return res.json({
    ok: check.isValid,
    path: filePath,
    reason: check.reason,
    expireAt: check.expireAt ?? null
  });
});

// Forecast demo
app.get('/api/forecast/ping', (_req, res) => {
  res.json({ ok: true, forecast: 'pong' });
});

// ====== Start ======
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`License server on http://localhost:${PORT}`);
  console.log(`Default license file: ${DEFAULT_LICENSE_PATH}`);
});
