// client/license-client.js  (ESM, Node 20+)
import fs from "node:fs/promises";
import path from "node:path";

const CFG = {
  LICENSE_DIR: path.resolve("./server/licenses"),
  ENDPOINT: process.env.LICENSE_ENDPOINT || "http://localhost:3001/api/license/latest",
  ENFORCE: String(process.env.LICENSE_ENFORCE ?? "true").toLowerCase() === "true",
  REQUIRE_CHECKSUM: String(process.env.LICENSE_REQUIRE_CHECKSUM ?? "false").toLowerCase() === "true",
  SIGN_SECRET: process.env.LICENSE_SIGN_SECRET || "",     // ถ้า verify checksum
  REFRESH_MIN: Number(process.env.LICENSE_REFRESH_INTERVAL_MIN ?? 1), // นาที
};

let latest = null;           // JSON ล่าสุดในหน่วยความจำ
let lastCheckedAt = 0;       // ms
let refreshTimer = null;

function now() { return Date.now(); }
function daysLeft(validUntilIso) {
  const ms = new Date(validUntilIso).getTime() - now();
  return Math.floor(ms / 86400000);
}

async function ensureDir() {
  await fs.mkdir(CFG.LICENSE_DIR, { recursive: true });
}

async function readLocalLatest() {
  await ensureDir();
  // หาไฟล์ล่าสุดในโฟลเดอร์ licenses
  const files = (await fs.readdir(CFG.LICENSE_DIR)).filter(f => f.endsWith(".json"));
  if (files.length === 0) return null;
  // ใช้ mtime ล่าสุด
  let best = null, bestTime = -1;
  for (const f of files) {
    const p = path.join(CFG.LICENSE_DIR, f);
    const st = await fs.stat(p);
    if (st.mtimeMs > bestTime) {
      bestTime = st.mtimeMs; best = p;
    }
  }
  if (!best) return null;
  const raw = await fs.readFile(best, "utf-8");
  return JSON.parse(raw);
}

async function writeLocal(lic) {
  await ensureDir();
  const fname = `${lic.id}.json`;
  const p = path.join(CFG.LICENSE_DIR, fname);
  await fs.writeFile(p, JSON.stringify(lic, null, 2), "utf-8");
  return p;
}

function verifyChecksumIfNeeded(lic) {
  if (!CFG.REQUIRE_CHECKSUM) return { ok: true };
  // ตัวอย่างตรวจเช็คด้วย SECRET (แนะนำ: ใช้ HMAC-SHA256 ฝั่งออกใบอนุญาตให้มาเป็น checksum)
  // ที่เซิร์ฟเวอร์เรายังไม่ได้บังคับ จึงให้ผ่านไปก่อน
  // TODO: เติม crypto.verify ที่สอดคล้องกับรูปแบบ checksum ของโปรเจกต์จริง
  return { ok: true };
}

function normalize(lic) {
  const dleft = daysLeft(lic.valid_until);
  return {
    status: dleft >= 0 ? "valid" : "expired",
    days_left: dleft,
    enforce: CFG.ENFORCE,
    require_checksum: CFG.REQUIRE_CHECKSUM,
    file: `${lic.id}.json`,
    owner: lic.owner,
    plan: lic.plan,
    valid_until: lic.valid_until,
  };
}

export async function fetchLatestFromServer() {
  const res = await fetch(CFG.ENDPOINT, { method: "GET" });
  if (!res.ok) throw new Error(`fetch ${CFG.ENDPOINT} ${res.status}`);
  const lic = await res.json();
  const v = verifyChecksumIfNeeded(lic);
  if (!v.ok) throw new Error("checksum_mismatch");
  await writeLocal(lic);
  latest = lic;
  lastCheckedAt = now();
  return lic;
}

export async function getLatestLicense() {
  if (latest) return latest;
  // ลองโหลดจากเครื่องก่อน
  const local = await readLocalLatest();
  if (local) { latest = local; return latest; }
  // ไม่มีในเครื่อง ลองยิงไปที่เซิร์ฟเวอร์
  try {
    return await fetchLatestFromServer();
  } catch {
    return null;
  }
}

export async function verifyLicense() {
  const lic = await getLatestLicense();
  if (!lic) return { ok: false, status: "no_license" };
  const d = normalize(lic);
  const ok = d.status === "valid";
  return { ok, ...d };
}

export function getCachedStatus() {
  if (!latest) return { ok: false, status: "no_license", enforce: CFG.ENFORCE };
  const d = normalize(latest);
  return { ok: d.status === "valid", ...d, last_checked_at: lastCheckedAt };
}

export function startAutoRefresh() {
  if (refreshTimer) return;
  const ms = Math.max(1, CFG.REFRESH_MIN) * 60_000;
  refreshTimer = setInterval(async () => {
    try { await fetchLatestFromServer(); }
    catch (_) { /* เงียบ: ใช้ local ต่อไป */ }
  }, ms);
}

export async function initLicenseClient() {
  await getLatestLicense();   // prime cache (server → local หรือ local)
  startAutoRefresh();
}

export function guardMiddleware() {
  // ใช้ปกป้อง Engine ในโหมด ENFORCE
  return async (_req, res, next) => {
    const v = await verifyLicense();
    if (!CFG.ENFORCE) return next();             // ไม่บังคับ ก็ปล่อยผ่าน
    if (v.ok) return next();                     // มี/ยังไม่หมดอายุ → ทำงานต่อ
    return res.status(403).json({ ok: false, error: "license_invalid", details: v });
  };
}
