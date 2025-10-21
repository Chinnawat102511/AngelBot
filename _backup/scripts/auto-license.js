// scripts/auto-license.js
// ใช้เป็น pre-hook ก่อน start server: ดึง license → verify → fallback เมื่อจำเป็น

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyFile,
  buildStablePayload,
  calcChecksum,
  findLatestFile,
} from "./verify-local-license.js";
import { promises as fs } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENDPOINT   = process.env.LICENSE_ENDPOINT || "http://localhost:3001/api/license/latest";
const LICENSE_DIR = path.resolve(__dirname, "../server/licenses");
const NEAR_DAYS  = Number(process.env.LICENSE_NEAR_DAYS || 7);

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function fetchLatest() {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`fetch ${ENDPOINT} -> ${res.status} ${res.statusText}`);
  return await res.json();
}

async function saveJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function toFileName(payload) {
  return `${payload?.id || "license"}.json`;
}

function log(result, tag = "auto-license") {
  console.log(`\n[${tag}] file: ${result.file}`);
  console.log(`owner/plan : ${result?.payload?.owner || "-"} / ${result?.payload?.plan || "-"}`);
  console.log(`valid_until: ${result?.payload?.valid_until || "-"}`);
  console.log(`checksum   : ${result.checksumOk ? "✅ OK" : "❌ MISMATCH"}`);
  if (typeof result.daysLeft === "number") {
    const exp = result.expiryOk ? "✅ OK" : "❌ EXPIRED";
    const near = result.nearExpiry ? " (near expiry)" : "";
    console.log(`expiry     : ${exp}${near} – left ~ ${result.daysLeft} day(s)`);
  }
  if (!result.ok && result.reasons?.length) for (const r of result.reasons) console.log(r);
}

export async function ensureLicense() {
  await ensureDir(LICENSE_DIR);
  try {
    console.log(`🚀 Auto: fetch latest license from ${ENDPOINT}`);
    const payload = await fetchLatest();

    // align checksum/stable payload
    const stable = buildStablePayload(payload);
    const want = calcChecksum(stable);
    if (!payload.checksum) payload.checksum = want;

    const out = path.join(LICENSE_DIR, toFileName(payload));
    await saveJson(out, payload);

    const v = await verifyFile(out, { requireChecksum: true, nearDays: NEAR_DAYS });
    log(v, "auto-license(remote)");
    if (!v.ok) throw new Error("remote verify failed");
    return v;
  } catch (e) {
    console.warn(`⚠️ auto fetch failed: ${e.message} → fallback to local`);
    const latest = await findLatestFile(LICENSE_DIR);
    if (!latest) throw new Error("no local license to fallback");
    const v = await verifyFile(latest, { requireChecksum: true, nearDays: NEAR_DAYS });
    log(v, "auto-license(local)");
    if (!v.ok) throw new Error("local verify failed");
    return v;
  }
}

if (import.meta.main) {
  ensureLicense()
    .then((v) => {
      if (v.nearExpiry) {
        console.warn(`🔔 License near expiry in ~${v.daysLeft} day(s).`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ ensureLicense failed:", err.message);
      process.exit(1);
    });
}
