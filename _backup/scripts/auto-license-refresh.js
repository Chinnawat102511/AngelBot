// scripts/auto-license-refresh.js
// Auto-Renew ใบอนุญาต: ถ้าใกล้หมดอายุ/หมดอายุ -> ออกใบใหม่อัตโนมัติ

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { verifyFile, findLatestFile, buildStablePayload, calcChecksum } from "./verify-local-license.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LICENSE_DIR = path.resolve(__dirname, "../server/licenses");

// ENV config
const RENEW_THRESHOLD_DAYS = Number(process.env.LICENSE_RENEW_THRESHOLD_DAYS || 7);   // <= N วันให้ต่ออายุ
const RENEW_DAYS           = Number(process.env.LICENSE_RENEW_DAYS || 30);           // อายุใบใหม่กี่วัน
const DEFAULT_OWNER        = process.env.LICENSE_OWNER || "AngelTeam";
const DEFAULT_PLAN         = process.env.LICENSE_PLAN  || "pro";

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }

async function issueNewLicense({ owner, plan, days = RENEW_DAYS }) {
  const id = randomUUID();
  const valid_until = new Date(Date.now() + days*24*60*60*1000).toISOString();
  const base = { id, owner, plan, valid_until };
  const checksum = calcChecksum(buildStablePayload(base));
  const finalJson = { ...base, checksum };

  await ensureDir(LICENSE_DIR);
  const outFile = path.join(LICENSE_DIR, `${id}.json`);
  await fs.writeFile(outFile, JSON.stringify(finalJson, null, 2), "utf8");

  return { outFile, json: finalJson };
}

export async function ensureLicenseRefresh() {
  await ensureDir(LICENSE_DIR);
  const latest = await findLatestFile(LICENSE_DIR);
  if (!latest) {
    // ยังไม่มีไฟล์เลย -> ออกใหม่ทันทีด้วยค่า DEFAULT
    const { outFile, json } = await issueNewLicense({ owner: DEFAULT_OWNER, plan: DEFAULT_PLAN });
    console.log("🆕 ไม่มีไฟล์เดิม -> ออกใบอนุญาตใหม่:", outFile);
    return { action: "created", file: outFile, payload: json };
  }

  const v = await verifyFile(latest, { requireChecksum: true, nearDays: RENEW_THRESHOLD_DAYS });
  const owner = v?.payload?.owner || DEFAULT_OWNER;
  const plan  = v?.payload?.plan  || DEFAULT_PLAN;

  if (!v.expiryOk || v.nearExpiry || !v.ok) {
    // หมดอายุ / ใกล้หมดอายุ / verify ไม่ผ่าน -> ต่ออายุทันที
    const { outFile, json } = await issueNewLicense({ owner, plan });
    console.log("🔄 Auto-renew license:", outFile);
    console.log(`   owner/plan : ${owner} / ${plan}`);
    console.log(`   valid_until: ${json.valid_until}`);
    return { action: "renewed", file: outFile, payload: json };
  }

  console.log("✅ ใบอนุญาตยังไม่ใกล้หมดอายุ – ไม่ต้องต่ออายุ");
  return { action: "skipped", file: latest, payload: v.payload };
}

if (import.meta.main) {
  ensureLicenseRefresh()
    .then(({ action, file }) => {
      console.log(`✔ done (${action}) -> ${file}`);
      process.exit(0);
    })
    .catch((e) => {
      console.error("❌ auto-license-refresh failed:", e.message);
      process.exit(1);
    });
}
