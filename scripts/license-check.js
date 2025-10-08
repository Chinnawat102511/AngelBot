// license-check.js
// สคริปต์เช็ค license จากโฟลเดอร์ server/licenses โดยตรง (ไม่ต้อง fetch)

import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyFile, findLatestFile } from "./verify-local-license.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ชี้ไปยัง server/licenses (ตามที่ขอ)
const LICENSE_DIR = path.resolve(__dirname, "server", "licenses");

function logResult(tag, result) {
  console.log(`\n[${tag}] file: ${result.file}`);
  console.log(`owner/plan : ${result?.payload?.owner || "-"} / ${result?.payload?.plan || "-"}`);
  console.log(`valid_until: ${result?.payload?.valid_until || "-"}`);
  console.log(`checksum   : ${result.checksumOk ? "✅ OK" : "❌ MISMATCH"}`);
  if (typeof result.daysLeft === "number") {
    const exp = result.expiryOk ? "✅ OK" : "❌ EXPIRED";
    const near = result.nearExpiry ? " (near expiry)" : "";
    console.log(`expiry     : ${exp}${near} – left ~ ${result.daysLeft} day(s)`);
  }
  if (!result.ok && result.reasons?.length) {
    for (const r of result.reasons) console.log(r);
  }
}

async function main() {
  const latest = await findLatestFile(LICENSE_DIR, (name) => name.endsWith(".json"));
  if (!latest) {
    console.error("❌ ไม่พบไฟล์ .json ใน server/licenses");
    process.exitCode = 1;
    return;
  }

  const v = await verifyFile(latest, { requireChecksum: true });
  logResult("license-check", v);
  process.exitCode = v.ok ? 0 : 1;
}

if (import.meta.main) {
  main();
}
