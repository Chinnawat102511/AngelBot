// C:\AngelBot\server\core\license-issue.js  (ESM)
import crypto from "node:crypto";

/** เวลาสิ้นวัน (UTC) ในรูป ISO 8601 */
function toIsoEndOfDay(dateOrStr) {
  const d = typeof dateOrStr === "string" ? new Date(dateOrStr) : new Date(dateOrStr);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  ).toISOString();
}

/** สร้าง checksum แบบ SHA-256 (hex) */
function sha256Hex(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * ออก license JSON มาตรฐาน
 * @param {{ owner:string, plan?:string, days?:number, meta?:any, expires?:string }} opts
 *  - days กับ expires เลือกส่งอย่างใดอย่างหนึ่ง (ถ้าไม่ส่งทั้งคู่ → ใช้ days=30)
 *  - expires รูปแบบ YYYY-MM-DD
 */
export function issueLicenseJson(opts = {}) {
  const owner = String(opts.owner || "AngelTeam");
  const plan = String(opts.plan || "pro");

  let valid_until;
  if (opts.expires) {
    valid_until = toIsoEndOfDay(opts.expires);
    if (!valid_until) throw new Error("invalid expires");
  } else {
    const days = Number(opts.days ?? 30);
    if (!Number.isFinite(days) || days <= 0) throw new Error("invalid days");
    const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    valid_until = toIsoEndOfDay(end);
  }

  const payload = {
    id: crypto.randomUUID(),
    owner,
    plan,
    valid_until,
  };

  if (typeof opts.meta !== "undefined") {
    payload.meta = opts.meta; // แนบ meta ถ้ามี
  }

  // สร้าง checksum → ผูกกับ SECRET เพื่อกันแก้ไข
  const secret = process.env.LICENSE_SIGN_SECRET || "angelbot-demo-secret";
  const checksum = sha256Hex(JSON.stringify(payload) + "|" + secret);

  return { ...payload, checksum };
}

/** ตรวจสอบ checksum ของ license */
export function verifyLicenseChecksum(lic) {
  if (!lic || typeof lic !== "object") return false;
  const secret = process.env.LICENSE_SIGN_SECRET || "angelbot-demo-secret";

  const payload = {
    id: lic.id,
    owner: lic.owner,
    plan: lic.plan,
    valid_until: lic.valid_until,
  };
  if (typeof lic.meta !== "undefined") payload.meta = lic.meta;

  const expect = sha256Hex(JSON.stringify(payload) + "|" + secret);
  return String(lic.checksum) === expect;
}

// เพื่อให้ import แบบ default ก็ใช้ได้
export default issueLicenseJson;
