// verify-local-license.js
// Node 20+ (ESM). ใช้ตรวจ license JSON แบบ local file

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * สร้าง JSON.stringify แบบเรียง key คงที่ เพื่อให้ทั้ง server และ client ตรวจ checksum ตรงกัน
 */
export function stableStringify(obj) {
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce((acc, k) => {
          acc[k] = sortKeys(value[k]);
          return acc;
        }, {});
    }
    return value;
  };
  return JSON.stringify(sortKeys(obj));
}

/**
 * เลือกเฉพาะฟิลด์ที่ใช้ทำ checksum (ต้องให้ฝั่ง server ใช้ logic แบบเดียวกัน 100%)
 * แนะนำให้คงรูปนี้ทั้งสองฝั่ง: id, owner, plan, valid_until
 */
export function buildStablePayload(raw) {
  if (!raw || typeof raw !== "object") return {};
  const { id, owner, plan, valid_until } = raw;
  return { id, owner, plan, valid_until };
}

/**
 * คำนวณ checksum = sha256(stableString + secret [ไม่บังคับ])
 * ถ้าไม่ตั้ง LICENSE_SECRET จะตรวจจาก stableString เพียว ๆ
 */
export function calcChecksum(payload, secret = process.env.LICENSE_SECRET || "") {
  const stable = typeof payload === "string" ? payload : stableStringify(payload);
  const h = createHash("sha256");
  h.update(stable + secret, "utf8");
  return h.digest("hex");
}

/**
 * อ่านไฟล์ + ตรวจ payload + ตรวจวันหมดอายุ + ตรวจ checksum
 * @param {string} filePath - path ไปยังไฟล์ license.json
 * @param {object} [opts]
 * @param {boolean} [opts.requireChecksum=true] - ถ้าจริง จะ fail เมื่อไม่มี checksum ในไฟล์
 * @param {number}  [opts.nearDays=7]          - แจ้งเตือนใกล้หมดอายุใน N วัน
 */
export async function verifyFile(filePath, opts = {}) {
  const { requireChecksum = true, nearDays = 7 } = opts;

  const res = {
    ok: false,
    file: filePath,
    reasons: [],
    payload: null,
    stablePayload: null,
    checksumInFile: null,
    checksumComputed: null,
    checksumOk: false,
    expiryOk: false,
    nearExpiry: false,
    daysLeft: null,
  };

  let rawText;
  try {
    rawText = await fs.readFile(filePath, "utf8");
  } catch (e) {
    res.reasons.push(`อ่านไฟล์ไม่ได้: ${e.message}`);
    return res;
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch (e) {
    res.reasons.push(`JSON ไม่ถูกต้อง: ${e.message}`);
    return res;
  }

  res.payload = json;
  const stable = buildStablePayload(json);
  res.stablePayload = stable;

  // ตรวจวันหมดอายุ
  if (!json.valid_until) {
    res.reasons.push("ไม่มีฟิลด์ valid_until");
  } else {
    const now = Date.now();
    const t = Date.parse(json.valid_until);
    if (Number.isNaN(t)) {
      res.reasons.push(`valid_until ไม่ใช่วันที่: ${json.valid_until}`);
    } else {
      const msLeft = t - now;
      const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
      res.daysLeft = daysLeft;
      res.expiryOk = msLeft > 0;
      res.nearExpiry = res.expiryOk && daysLeft <= nearDays;
      if (!res.expiryOk) res.reasons.push("❌ หมดอายุแล้ว");
    }
  }

  // ตรวจ checksum
  const checksumInFile = json.checksum;
  res.checksumInFile = checksumInFile || null;

  const computed = calcChecksum(stable);
  res.checksumComputed = computed;

  if (checksumInFile) {
    res.checksumOk = checksumInFile === computed;
    if (!res.checksumOk) res.reasons.push("❌ checksum ไม่ตรง");
  } else if (requireChecksum) {
    res.reasons.push("❌ ไม่มี checksum ในไฟล์ (ตั้ง requireChecksum=true)");
  }

  res.ok = res.expiryOk && (res.checksumOk || !requireChecksum);
  return res;
}

/**
 * ค้นหาไฟล์ล่าสุดในโฟลเดอร์ (ตาม mtime)
 * @param {string} dir
 * @param {(name:string)=>boolean} [filterFn]
 */
export async function findLatestFile(dir, filterFn = (name) => name.endsWith(".json")) {
  const list = await fs.readdir(dir, { withFileTypes: true });
  const files = list
    .filter((d) => d.isFile() && filterFn(d.name))
    .map((d) => path.join(dir, d.name));

  if (files.length === 0) return null;

  const stats = await Promise.all(
    files.map(async (f) => ({ f, mtimeMs: (await fs.stat(f)).mtimeMs }))
  );
  stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return stats[0].f;
}
