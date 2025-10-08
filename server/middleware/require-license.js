// server/middleware/require-license.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ใช้ตัวตรวจเดิมจากสคริปต์
import { verifyFile, findLatestFile } from "../../scripts/verify-local-license.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LICENSE_DIR = path.join(__dirname, "..", "licenses");

// cache เบา ๆ เพื่อลด IO
let lastCheck = 0;
let lastOk = false;
const TTL_MS = 5_000; // 5s

async function isLicenseValid() {
  // ไม่มี ENFORCE ก็ถือว่าผ่าน
  const ENFORCE = (process.env.LICENSE_ENFORCE || "true") === "true";
  if (!ENFORCE) return true;

  const now = Date.now();
  if (now - lastCheck < TTL_MS) return lastOk;

  lastCheck = now;

  if (!fs.existsSync(LICENSE_DIR)) {
    lastOk = false;
    return false;
  }

  const latest = await findLatestFile(LICENSE_DIR);
  if (!latest) {
    lastOk = false;
    return false;
  }

  const v = await verifyFile(latest, { requireChecksum: true, nearDays: 0 });
  lastOk = Boolean(v.ok && v.expiryOk);
  return lastOk;
}

/**
 * Middleware: บังคับต้องมีไลเซนส์ที่ยังไม่หมดอายุ
 * - อนุญาต /api/license/* เสมอ (เพื่อเช็ก/อัปโหลด)
 */
export function requireLicense() {
  return async (req, res, next) => {
    // ให้ผ่านสำหรับ endpoint จัดการไลเซนส์
    if (req.path.startsWith("/license")) return next();

    const ok = await isLicenseValid();
    if (!ok) {
      return res.status(403).json({
        error: "license_expired",
        message:
          "Your license is expired or invalid. Please contact admin to issue a new license and upload it.",
      });
    }
    next();
  };
}
