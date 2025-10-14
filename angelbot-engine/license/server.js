// angelbot-engine/license/server.js  (CommonJS)
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.LICENSE_PORT || 3001);
const HOST = '127.0.0.1';

// base ที่ Engine จะใช้ ping/validate
const FORECAST_BASE =
  process.env.LICENSE_FORECAST_BASE || `http://${HOST}:${PORT}/api/forecast`;

// เก็บ license ล่าสุดในหน่วยความจำ (และจะเขียนไฟล์ไว้ที่ license_output ด้วย)
let latestLicense = null;

const app = express();

// --- CORS + body parsers ---
app.use(cors({ origin: '*', credentials: false }));
app.options('*', cors());
// ใช้ json เป็นตัวหลักทั่วทั้งแอป
app.use(express.json({ limit: '2mb' }));

// mini logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ──────────────────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────────────────
app.get('/api/forecast/ping', (_req, res) => {
  res.json({ ok: true, service: 'license-forecast', pong: true });
});

// ──────────────────────────────────────────────────────────
// Latest (กัน 404 ฝั่ง UI)
// ──────────────────────────────────────────────────────────
app.get('/api/license/latest', (_req, res) => {
  if (latestLicense) return res.json(latestLicense);
  return res.json({
    ok: true,
    base: FORECAST_BASE,
    exp: '2099-12-31T00:00:00Z',
    token: 'dev-local',
    note: 'stub-latest',
  });
});

// ──────────────────────────────────────────────────────────
// Upload license (รองรับทั้ง application/json และ text/plain)
// หมายเหตุ: ถ้า UI เคยส่ง multipart/form-data มาก่อน ให้ปรับ UI ให้ส่ง
// เนื้อไฟล์ JSON เป็น body ตรงๆ พร้อม header 'Content-Type: application/json'
// ──────────────────────────────────────────────────────────
app.post(
  '/api/license/upload',
  // อ่านเป็น text เพื่อให้รองรับทั้ง application/json และ text/plain
  express.text({ type: ['application/json', 'text/plain', '*/*'], limit: '2mb' }),
  (req, res) => {
    try {
      const body = req.body;
      const data =
        typeof body === 'string' && body.trim().length
          ? JSON.parse(body)
          : typeof req.body === 'object'
          ? req.body
          : null;

      if (!data || typeof data !== 'object') {
        return res.status(400).json({ ok: false, error: 'invalid license payload' });
      }

      // เช็คคร่าว ๆ ว่าเป็น license
      if (typeof data.name !== 'string' || typeof data.exp !== 'string') {
        return res.status(400).json({ ok: false, error: 'invalid license json shape' });
      }

      latestLicense = {
        ...data,
        ok: true,
        base: data.base || FORECAST_BASE,
        service: data.service || 'license-forecast',
        note: data.note || 'uploaded',
      };

      // เขียนไฟล์เก็บไว้ (เพื่อให้หาเจอในภายหลัง)
      try {
        const outDir = path.join(process.cwd(), 'license_output');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const safeName = String(latestLicense.name || 'AngelTeam').replace(/[^\w.-]+/g, '_');
        const outFile = path.join(outDir, `license_${safeName}.json`);
        fs.writeFileSync(outFile, JSON.stringify(latestLicense, null, 2), 'utf8');
      } catch (e) {
        console.warn('write file error:', e?.message || e);
      }

      return res.json({
        ok: true,
        uploaded: true,
        name: latestLicense.name,
        exp: latestLicense.exp,
        base: latestLicense.base,
      });
    } catch (e) {
      return res
        .status(400)
        .json({ ok: false, error: 'invalid-json', detail: String(e.message || e) });
    }
  }
);

// ──────────────────────────────────────────────────────────
// Validate / Check / Verify
// ──────────────────────────────────────────────────────────
function buildFeaturePack(valid) {
  return {
    autotrade: true,
    intervalMs: valid ? 1500 : 3000,
    maxSymbols: valid ? 20 : 5,
  };
}

function lookupLicense(licenseKey) {
  const valid = !!licenseKey && String(licenseKey).trim().length >= 8;
  return {
    valid,
    plan: valid ? 'pro' : 'free',
    features: buildFeaturePack(valid),
    expiresAt: latestLicense?.exp ?? '2099-12-31T00:00:00Z',
    meta: { issuedBy: 'license-dev', region: 'th' },
  };
}

app.post(
  ['/api/forecast/validate', '/api/forecast/check', '/api/license/validate'],
  (req, res) => {
    const { licenseKey, agent } = req.body || {};
    const info = lookupLicense(licenseKey);
    res.json({
      ok: true,
      ...info,
      agent: agent || 'unknown',
      base: FORECAST_BASE,
    });
  }
);

app.get('/api/license/verify', (_req, res) => {
  res.json({
    ok: true,
    valid: true,
    base: FORECAST_BASE,
    exp: latestLicense?.exp ?? '2099-12-31T00:00:00Z',
  });
});

// ──────────────────────────────────────────────────────────
// Generate (Dev tool)
// ──────────────────────────────────────────────────────────
app.post('/api/license/generate', (req, res) => {
  const name = String(req.body?.name ?? 'AngelTeam');
  const days = Math.max(1, Number(req.body?.days ?? 30));
  const wantDownload = !!req.body?.download;

  const exp = new Date();
  exp.setDate(exp.getDate() + days);

  latestLicense = {
    ok: true,
    name,
    base: FORECAST_BASE,
    exp: exp.toISOString(),
    token: 'local-dev-token',
    service: 'license-forecast',
    note: 'generated-by-local-license-server',
  };

  try {
    const outDir = path.join(process.cwd(), 'license_output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `license_${name}.json`);
    fs.writeFileSync(outFile, JSON.stringify(latestLicense, null, 2), 'utf8');
  } catch (e) {
    console.warn('write file error:', e?.message || e);
  }

  if (wantDownload) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="license_${name}.json"`);
    return res.status(200).send(Buffer.from(JSON.stringify(latestLicense, null, 2), 'utf8'));
  }
  return res.json({ ok: true, license: latestLicense });
});

// ──────────────────────────────────────────────────────────
// Optional config
// ──────────────────────────────────────────────────────────
app.get('/api/forecast/config', (_req, res) => {
  res.json({
    ok: true,
    defaults: { autotrade: true, intervalMs: 2000, maxSymbols: 10 },
  });
});

// ──────────────────────────────────────────────────────────
// 404 + Error handler
// ──────────────────────────────────────────────────────────
app.use((_req, _res, next) => next(Object.assign(new Error('Not Found'), { status: 404 })));
app.use((err, _req, res, _next) =>
  res.status(Number(err.status || 500)).json({
    ok: false,
    error: String(err.message || 'Unexpected error'),
  })
);

// ──────────────────────────────────────────────────────────
// Dump routes on start (ช่วยตรวจรายการ route)
// ──────────────────────────────────────────────────────────
function dumpRoutes() {
  const routes = [];
  app._router.stack.forEach((s) => {
    if (s.route && s.route.path) {
      const methods = Object.keys(s.route.methods).join(',').toUpperCase();
      routes.push(`${methods.padEnd(6)} ${s.route.path}`);
    }
  });
  console.log('Registered routes:\n' + routes.map((r) => '  ' + r).join('\n'));
}

app.listen(PORT, HOST, () => {
  console.log(`License server listening on http://${HOST}:${PORT}`);
  console.log(`[env] FORECAST_BASE = ${FORECAST_BASE}`);
  dumpRoutes();
});
