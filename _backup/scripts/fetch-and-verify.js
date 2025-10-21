// fetch-and-verify.js
// ดึง license จาก endpoint (ตั้งค่าได้ด้วย env) -> เซฟลง server/licenses -> verify ด้วย verifyFile
// ถ้าดึงไม่สำเร็จ จะ fallback ไปอ่านไฟล์ล่าสุดใน server/licenses

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyFile,
  buildStablePayload,
  stableStringify,
  calcChecksum,
  findLatestFile,
} from "./verify-local-license.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LICENSE_DIR = path.resolve(__dirname, "server", "licenses");

// ตั้งค่า endpoint ผ่าน env ได้ เช่น:
//   set LICENSE_ENDPOINT=http://localhost:3001/api/license/latest
const ENDPOINT = process.env.LICENSE_ENDPOINT || "http://localhost:3001/api/license/latest";

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function saveJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

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

async function fetchLatest() {
  const res = await fetch(ENDPOINT, { method: "GET" });
  if (!res.ok) throw new Error(`Fetch ${ENDPOINT} -> ${res.status} ${res.statusText}`);
  return await res.json();
}

function toFileName(payload) {
  // สร้างชื่อไฟล์จาก id หรือ checksum เพื่อกันซ้ำ
  const id = payload?.id || "license";
  return `${id}.json`;
}

async function main() {
  await ensureDir(LICENSE_DIR);

  let fetched = null;
  try {
    console.log(`🌐 fetching license from: ${ENDPOINT}`);
    fetched = await fetchLatest();

    // ตรวจให้แน่ใจว่า checksum ใน payload สอดคล้องกับ stablePayload
    const stable = buildStablePayload(fetched);
    const wantChecksum = calcChecksum(stable);
    if (!fetched.checksum) {
      console.warn("⚠️  license จาก server ไม่มี checksum – จะเติมให้ตามสูตรฝั่ง client");
      fetched.checksum = wantChecksum;
    } else if (fetched.checksum !== wantChecksum) {
      console.warn("⚠️  checksum จาก server ไม่ตรงกับฝั่ง client – จะใช้ของ server แต่แจ้งเตือน");
    }

    const filename = toFileName(fetched);
    const outFile = path.join(LICENSE_DIR, filename);
    await saveJson(outFile, fetched);

    const verified = await verifyFile(outFile, { requireChecksum: true });
    logResult("fetch-and-verify (remote)", verified);

    if (!verified.ok) {
      console.warn("⚠️  remote license verify ไม่ผ่าน จะลอง fallback local ล่าสุดแทน");
      const latest = await findLatestFile(LICENSE_DIR);
      if (latest) {
        const v2 = await verifyFile(latest, { requireChecksum: true });
        logResult("fallback (local-latest)", v2);
        process.exitCode = v2.ok ? 0 : 1;
      } else {
        console.error("❌ ไม่มีไฟล์ local ให้ fallback");
        process.exitCode = 1;
      }
    } else {
      process.exitCode = 0;
    }
  } catch (err) {
    console.warn(`⚠️  fetch ล้มเหลว: ${err.message}`);
    console.warn("➡️  จะลองใช้ไฟล์ local ล่าสุดแทน");
    const latest = await findLatestFile(LICENSE_DIR);
    if (latest) {
      const v2 = await verifyFile(latest, { requireChecksum: true });
      logResult("fallback (local-latest)", v2);
      process.exitCode = v2.ok ? 0 : 1;
    } else {
      console.error("❌ ไม่มีไฟล์ local ให้ fallback");
      process.exitCode = 1;
    }
  }
}

if (import.meta.main) {
  main();
}
