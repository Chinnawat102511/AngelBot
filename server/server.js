import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

// ใช้ตามที่โปรเจกต์คุณมีอยู่ (มีหรือไม่มีไม่เป็นไร)
import { ensureLicense } from "../scripts/auto-license.js";
import { ensureLicenseRefresh } from "../scripts/auto-license-refresh.js";
import { verifyFile, findLatestFile } from "../scripts/verify-local-license.js";

const app = express();

/* -------------------- Middlewares -------------------- */
app.use(express.json({ limit: "256kb" }));
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* -------------------- Paths / Constants -------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LICENSE_DIR = path.join(__dirname, "licenses");

/* -------------------- Helpers -------------------- */
async function getLatestLicensePath() {
  if (!fs.existsSync(LICENSE_DIR)) return null;
  const latest = await findLatestFile(LICENSE_DIR);
  if (!latest) return null;
  if (typeof latest === "string") return latest;
  return latest.path || latest.file || latest.filePath || null;
}

function toIsoEndOfDay(dateOrStr) {
  const d =
    typeof dateOrStr === "string" ? new Date(dateOrStr) : new Date(dateOrStr);
  if (Number.isNaN(d.getTime())) return null;
  // บังคับเป็น UTC 23:59:59.999
  const iso = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  ).toISOString();
  return iso;
}

/* -------------------- Public endpoints -------------------- */

app.get("/api/forecast/ping", (_req, res) => {
  res.json({ ok: true, service: "forecast", ts: Date.now() });
});

app.get("/", (_req, res) => {
  res
    .type("text")
    .send("AngelBot License Server is running. Try: GET /api/license/latest");
});

app.get("/api/license/latest", (_req, res) => {
  try {
    if (!fs.existsSync(LICENSE_DIR)) {
      return res.status(404).json({ error: "licenses folder not found" });
    }
    const files = fs
      .readdirSync(LICENSE_DIR)
      .filter((f) => f.endsWith(".json"));
    if (files.length === 0) return res.status(404).json({ error: "no license found" });

    const latest = files
      .map((name) => ({
        name,
        mtime: fs.statSync(path.join(LICENSE_DIR, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)[0];

    const json = JSON.parse(
      fs.readFileSync(path.join(LICENSE_DIR, latest.name), "utf8")
    );
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/license/upload", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const tmpName = `${crypto.randomUUID()}.json`;
    const tmpPath = path.join(__dirname, tmpName);
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf8");

    // ตรวจความถูกต้อง (checksum + expiry)
    const v = await verifyFile(tmpPath, { requireChecksum: true, nearDays: 0 });
    if (!v.ok || !v.checksumOk) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: "verify_failed", details: v });
    }

    if (!fs.existsSync(LICENSE_DIR))
      fs.mkdirSync(LICENSE_DIR, { recursive: true });

    const finalName = `${crypto.randomUUID()}.json`;
    const finalPath = path.join(LICENSE_DIR, finalName);
    fs.renameSync(tmpPath, finalPath);

    const expiryOk = v.expiryOk === true;
    res.json({
      ok: true,
      saved: path.basename(finalPath),
      expiryOk,
      message: expiryOk ? "License saved & valid." : "License saved but expired.",
    });
  } catch (e) {
    res.status(500).json({ error: "upload_error", message: e.message });
  }
});

/* -------------------- Generate via API -------------------- */
/**
 * POST /api/license/generate
 * body:
 *  - owner: string (required)
 *  - plan: string (default: "pro")
 *  - days?: number
 *  - expires?: string (YYYY-MM-DD)
 * NOTE: checksum สร้างแบบ sha256(owner|plan|valid_until) เพื่อความเรียบง่าย
 *       ถ้าคุณมีอัลกอริทึมเฉพาะในโปรเจกต์เดิม ให้ปรับตรงนี้ให้เหมือนกัน
 */
app.post("/api/license/generate", async (req, res) => {
  try {
    const { owner, plan = "pro", days, expires } = req.body || {};
    if (!owner || typeof owner !== "string")
      return res.status(400).json({ error: "owner_required" });

    let valid_until = null;

    if (typeof days === "number" && Number.isFinite(days)) {
      const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      valid_until = toIsoEndOfDay(d);
    } else if (expires) {
      valid_until = toIsoEndOfDay(expires);
    } else {
      return res
        .status(400)
        .json({ error: "days_or_expires_required" });
    }

    if (!valid_until) return res.status(400).json({ error: "invalid_date" });

    // checksum แบบทั่วไป (ปรับตามระบบคุณได้)
    const checksum = crypto
      .createHash("sha256")
      .update(`${owner}|${plan}|${valid_until}`)
      .digest("hex");

    const license = {
      id: crypto.randomUUID(),
      owner,
      plan,
      valid_until,
      checksum,
    };

    if (!fs.existsSync(LICENSE_DIR))
      fs.mkdirSync(LICENSE_DIR, { recursive: true });

    const filename = `${license.id}.json`;
    const filepath = path.join(LICENSE_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(license, null, 2), "utf8");

    res.json({ ok: true, saved: filename, license });
  } catch (e) {
    res.status(500).json({ error: "generate_error", message: e.message });
  }
});

/* ------------- License Enforcement (optional) ------------- */
const ENFORCE = (process.env.LICENSE_ENFORCE || "true") === "true";

async function isLicenseValid() {
  const latestPath = await getLatestLicensePath();
  if (!latestPath) return false;

  // ผ่อนปรน checksum สำหรับ dev ให้ผ่านได้ก่อน
  const v = await verifyFile(latestPath, { requireChecksum: false, nearDays: 0 });
  return v.ok && v.expiryOk;
}

app.use(async (req, res, next) => {
  if (!ENFORCE) return next();

  if (
    req.path.startsWith("/api/license") ||
    req.path === "/api/forecast/ping" ||
    req.method === "OPTIONS"
  ) {
    return next();
  }

  const ok = await isLicenseValid();
  if (!ok) {
    return res.status(403).json({
      error: "license_expired",
      message: "Your license is expired or invalid. Please contact admin.",
    });
  }
  next();
});

/* -------------------- Verify endpoint -------------------- */
app.get("/api/license/verify", async (_req, res) => {
  try {
    if (!fs.existsSync(LICENSE_DIR)) {
      return res.status(404).json({ status: "expired", reason: "no_license_dir" });
    }
    const latestPath = await findLatestFile(LICENSE_DIR);
    if (!latestPath) return res.json({ status: "expired", reason: "no_file" });

    const nearDays = Number(process.env.LICENSE_RENEW_THRESHOLD_DAYS || 7);

    // ผ่อนปรน checksum สำหรับ dev
    const v = await verifyFile(latestPath, { requireChecksum: false, nearDays });

    let days_left = null;
    if (v.validUntil) {
      const leftMs = new Date(v.validUntil).getTime() - Date.now();
      days_left = Math.floor(leftMs / (24 * 60 * 60 * 1000));
    }

    let status = "expired";
    if (v.ok && v.expiryOk) status = "ok";
    else if (v.ok && !v.expiryOk && v.near) status = "near";

    return res.json({
      status,
      days_left,
      valid_until: v.validUntil || null,
      checksum_ok: !!v.checksumOk,
    });
  } catch (e) {
    return res.status(500).json({ error: "verify_failed", message: e.message });
  }
});

/* -------------------- Boot -------------------- */
const PORT = Number(process.env.LICENSE_PORT || 3001);
const REFRESH_INTERVAL_MIN = Number(process.env.LICENSE_REFRESH_INTERVAL_MIN || 60);

(async () => {
  try {
    await ensureLicense?.();
    await ensureLicenseRefresh?.();
  } catch (e) {
    console.warn("⚠️ preflight license step warning:", e?.message);
  }

  app.listen(PORT, () => {
    console.log(`✅ License server running on http://localhost:${PORT}`);
    console.log(`➡️  GET  /api/license/latest`);
    console.log(`➡️  POST /api/license/upload`);
    console.log(`➡️  POST /api/license/generate`);
    console.log(`➡️  GET  /api/forecast/ping`);
  });

  setInterval(async () => {
    try {
      await ensureLicenseRefresh?.();
    } catch (e) {
      console.warn("⚠️ background auto-renew failed:", e?.message);
    }
  }, REFRESH_INTERVAL_MIN * 60 * 1000);
})();
