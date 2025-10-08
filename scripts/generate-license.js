// scripts/generate-license.js
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { buildStablePayload, calcChecksum } from "./verify-local-license.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ค่าเริ่มต้น: เก็บไว้ที่ server/licenses (เดิม)
const DEFAULT_OUT_DIR = path.resolve(__dirname, "../server/licenses");

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function endOfDayISO(d) {
  const dt = new Date(d);
  // set 23:59:59.999 ตามเขตเวลาเครื่อง
  dt.setHours(23, 59, 59, 999);
  return dt.toISOString();
}

function parseExpires(value) {
  // รองรับ YYYY-MM-DD หรือ ISO ตรง ๆ
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return endOfDayISO(value);
  }
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }
async function saveJson(file, data) { await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8"); }

async function main() {
  const args = parseArgs(process.argv);

  // ---- aliases / env fallbacks ----
  const owner = args.owner || args.user || process.env.LICENSE_OWNER || "AngelTeam";
  const plan  = args.plan  || process.env.LICENSE_PLAN  || "pro";
  const days  = Number(args.days || process.env.LICENSE_DAYS || 30);

  // expires จะ override days หากระบุมา
  const expiresIso = parseExpires(args.expires);
  const valid_until = expiresIso || new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const id = args.id || randomUUID();

  // กำหนดโฟลเดอร์/ไฟล์ปลายทางได้
  const outDir = path.resolve(args.out || process.env.LICENSE_DIR || DEFAULT_OUT_DIR);
  const filename = (args.filename && args.filename.trim()) || `${id}.json`;
  const outFile = path.join(outDir, filename);

  const base = { id, owner, plan, valid_until };

  // ✅ checksum จาก stable payload เดียวกับฝ่าย verify
  const stable   = buildStablePayload(base);
  const checksum = calcChecksum(stable);
  const finalJson = { ...base, checksum };

  await ensureDir(outDir);
  await saveJson(outFile, finalJson);

  // log สวย ๆ
  console.log("✅ สร้าง license สำเร็จ");
  console.log(`   file       : ${outFile}`);
  console.log(`   owner/plan : ${owner} / ${plan}`);
  console.log(`   valid_until: ${valid_until}${expiresIso ? "  (from --expires)" : `  (+${days} days)`}`);
  console.log(`   checksum   : ${checksum}`);
}

main().catch(e => {
  console.error("❌ generate-license ล้มเหลว:", e);
  process.exit(1);
});
