import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import crypto from "crypto";
import cors from "cors";

// ⬇️ import routes (ถูกแล้ว)
import generateRoute from "./routes/generate.js";
import verifyRoute from "./routes/verify.js"; // <--- เพิ่มตรงนี้เลย

// ⬇️ รองรับ ES Module: สร้าง __dirname เอง
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ⬇️ ประกาศ app ก่อน
const app = express();
app.use(cors());
app.use(express.json());

// ⬇️ ค่อยติดตั้ง routes หลังจากมี app แล้ว
app.use("/api/license/generate", generateRoute);
app.use("/api/license/verify", verifyRoute); // <--- เพิ่มตรงนี้ตามลำดับ

const LICENSE_DIR = path.join(__dirname, "licenses");
const SECRET = process.env.LICENSE_SECRET || "dev-secret";

// ===== Utilities =====

function stablePayload(data) {
  return {
    v: data.v,
    id: data.id,
    owner: data.owner,
    plan: data.plan,
    issuedAt: data.issuedAt,
    expiresAt: data.expiresAt,
    features: data.features,
  };
}

function calcChecksum(payload, secret = SECRET) {
  return crypto.createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}

function readLatestLicense() {
  if (!fs.existsSync(LICENSE_DIR)) return null;
  const files = fs.readdirSync(LICENSE_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) return null;
  const latest = files.sort((a, b) => {
    return fs.statSync(path.join(LICENSE_DIR, b)).mtimeMs -
           fs.statSync(path.join(LICENSE_DIR, a)).mtimeMs;
  })[0];
  const full = path.join(LICENSE_DIR, latest);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}


function verifyLicenseObject(data) {
  if (!data) throw new Error("No license file found");
  const expected = calcChecksum(stablePayload(data));
  if (data.checksum !== expected) throw new Error("Invalid checksum");
  const now = Date.now();
  const exp = new Date(data.expiresAt).getTime();
  if (!Number.isFinite(exp) || now > exp) throw new Error("License expired");
  return data;
}

// ===== Generator (reusable) =====
function createLicense({ owner, days, plan = "pro" }) {
  const id = crypto.randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + parseInt(days, 10) * 86400_000);

  const payload = {
    v: 1,
    id,
    owner,
    plan,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    features: ["angelbot", "forecast"],
  };
  const checksum = calcChecksum(payload);
  const license = { ...payload, checksum };

  fs.mkdirSync(LICENSE_DIR, { recursive: true });
  const outPath = path.join(LICENSE_DIR, `${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(license, null, 2), "utf8");

  return license;
}

// ===== Auto ensure on boot =====
function ensureLicenseOnBoot() {
  const enabled = String(process.env.LICENSE_AUTO_ENABLED || "true").toLowerCase() === "true";
  if (!enabled) return;

  try {
    const existing = readLatestLicense();
    verifyLicenseObject(existing);
    console.log(`✅ License OK: ${existing.owner} (${existing.plan}), valid until ${existing.expiresAt}`);
  } catch (e) {
    const owner = process.env.LICENSE_AUTO_OWNER || "AngelTeam";
    const days  = parseInt(process.env.LICENSE_AUTO_DAYS || "30", 10);
    const plan  = process.env.LICENSE_AUTO_PLAN || "pro";

    const lic = createLicense({ owner, days, plan });
    console.log(`[AUTO] License generated for ${lic.owner} (${lic.plan})`);
    console.log(`✅ License OK: ${lic.owner} (${lic.plan}), valid until ${lic.expiresAt}`);
  }
}

// ===== Helper: Read by ID =====
function readById(id) {
  const full = path.join(LICENSE_DIR, `${id}.json`);
  if (!fs.existsSync(full)) throw new Error("License not found");
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

// ===== API =====

// ping
app.get("/ping", (_req, res) => {
  res.json({ message: "Pong from AngelBot license server ✅" });
});

// verify latest
app.get("/api/license/verify", (_req, res) => {
  try {
    const data = verifyLicenseObject(readLatestLicense());
    res.json({
      status: "ok",
      owner: data.owner,
      plan: data.plan,
      valid_until: data.expiresAt,
      message: "License verified ✅",
    });
  } catch (err) {
    res.status(/expired/i.test(err.message) ? 403 : 400).json({
      status: "error",
      message: err.message,
    });
  }
});

// generate
app.post("/api/license/generate", (req, res) => {
  try {
    const { owner, days, plan = "pro" } = req.body || {};
    if (!owner || !days)
      return res.status(400).json({ error: "owner and days are required" });

    const lic = createLicense({ owner, days, plan });
    res.json({ status: "ok", license: lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚫 block GET generate
app.get("/api/license/generate", (_req, res) => {
  res.status(405).send(
    "⚠️ ใช้วิธี POST /api/license/generate พร้อม JSON body เช่น { owner, days, plan } เท่านั้น"
  );
});

// ===== New APIs =====

// list all licenses
app.get("/api/licenses", (_req, res) => {
  try {
    if (!fs.existsSync(LICENSE_DIR)) fs.mkdirSync(LICENSE_DIR, { recursive: true });
    const files = fs.readdirSync(LICENSE_DIR).filter(f => f.endsWith(".json"));
    const items = files.map(f => {
      const id = f.replace(/\.json$/, "");
      const full = path.join(LICENSE_DIR, f);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      let status = "ok";
      try { verifyLicenseObject(data); } catch (e) { status = e.message; }
      return {
        id,
        owner: data.owner,
        plan: data.plan,
        issuedAt: data.issuedAt,
        expiresAt: data.expiresAt,
        status,
        size: fs.statSync(full).size,
        mtime: fs.statSync(full).mtime.toISOString(),
      };
    }).sort((a,b)=> new Date(b.mtime)-new Date(a.mtime));
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// view by id
app.get("/api/license/:id", (req, res) => {
  try {
    const data = readById(req.params.id);
    res.json({ id: req.params.id, license: data });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// download
app.get("/api/license/:id/download", (req, res) => {
  try {
    const full = path.join(LICENSE_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(full)) throw new Error("License not found");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.id}.json"`);
    fs.createReadStream(full).pipe(res);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ===== Boot =====
ensureLicenseOnBoot();

app.listen(4000, () => {
  console.log("🚀 AngelBot license server running on http://localhost:4000");
});


// ===== Auto Alert =====
const ALERT_DAYS = Number(process.env.LICENSE_ALERT_DAYS || 7);
const ALERT_EVERY_MS = Number(process.env.LICENSE_ALERT_EVERY_MS || 60 * 60 * 1000);

setInterval(() => {
  try {
    const data = readLatestLicense();
    if (!data) return;
    const exp = new Date(data.expiresAt).getTime();
    const daysLeft = (exp - Date.now()) / 86400_000;
    if (daysLeft <= ALERT_DAYS && daysLeft > 0) {
      console.warn(`🔔 License of "${data.owner}" (${data.plan}) เหลือเวลา ${daysLeft.toFixed(1)} วัน`);
    } else if (daysLeft <= 0) {
      console.error("⛔ License หมดอายุแล้ว — โปรดต่ออายุทันที!");
    }
  } catch {}
}, ALERT_EVERY_MS);

// ===== NEW: List all licenses =====
app.get("/api/licenses", (_req, res) => {
  try {
    if (!fs.existsSync(LICENSE_DIR)) return res.json([]);
    const files = fs.readdirSync(LICENSE_DIR).filter(f => f.endsWith(".json"));
    const items = files.map(f => {
      const full = path.join(LICENSE_DIR, f);
      const raw = JSON.parse(fs.readFileSync(full, "utf8"));
      const expMs = new Date(raw.expiresAt).getTime();
      const now = Date.now();
      return {
        id: raw.id,
        file: f,
        owner: raw.owner,
        plan: raw.plan,
        issuedAt: raw.issuedAt,
        expiresAt: raw.expiresAt,
        valid: Number.isFinite(expMs) && now <= expMs,
        mtime: fs.statSync(full).mtimeMs,
      };
    }).sort((a, b) => b.mtime - a.mtime);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// ===== NEW: View license JSON by :id =====
app.get("/api/licenses/:id", (req, res) => {
  try {
    const id = req.params.id;
    if (!fs.existsSync(LICENSE_DIR)) return res.status(404).json({ error: "No license dir" });
    const file = fs.readdirSync(LICENSE_DIR).find(f => f.startsWith(id) && f.endsWith(".json"));
    if (!file) return res.status(404).json({ error: "License not found" });
    const json = JSON.parse(fs.readFileSync(path.join(LICENSE_DIR, file), "utf8"));
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// ===== NEW: Download license file (.json) =====
app.get("/api/licenses/:id/download", (req, res) => {
  try {
    const id = req.params.id;
    if (!fs.existsSync(LICENSE_DIR)) return res.status(404).send("No license dir");
    const file = fs.readdirSync(LICENSE_DIR).find(f => f.startsWith(id) && f.endsWith(".json"));
    if (!file) return res.status(404).send("License not found");
    const full = path.join(LICENSE_DIR, file);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    fs.createReadStream(full).pipe(res);
  } catch (err) {
    res.status(500).send(err?.message || String(err));
  }
});
