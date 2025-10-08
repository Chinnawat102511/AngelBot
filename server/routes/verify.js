// server/routes/verify.js
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const LICENSE_DIR = path.resolve("server/licenses");
const SECRET = process.env.LICENSE_SECRET || "dev-secret";

// ---- helpers ----
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

  const latest = files.sort((a, b) =>
    fs.statSync(path.join(LICENSE_DIR, b)).mtimeMs -
    fs.statSync(path.join(LICENSE_DIR, a)).mtimeMs
  )[0];

  const full = path.join(LICENSE_DIR, latest);
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    // กรณีไฟล์เสีย/parse ไม่ได้
    const err = new Error("Corrupted license file");
    err.code = "CORRUPTED";
    throw err;
  }
}

// ---- GET / (verify latest) ----
router.get("/", (_req, res) => {
  try {
    const lic = readLatestLicense();
    if (!lic) {
      return res.status(404).json({ status: "error", message: "No license file found" });
    }

    const expected = calcChecksum(stablePayload(lic));
    if (lic.checksum !== expected) {
      return res.status(400).json({ status: "invalid", message: "Invalid checksum" });
    }

    const now = Date.now();
    const exp = new Date(lic.expiresAt).getTime();
    if (!Number.isFinite(exp) || now > exp) {
      return res.status(403).json({ status: "expired", message: "License expired" });
    }

    return res.json({
      status: "ok",
      owner: lic.owner,
      plan: lic.plan,
      valid_until: lic.expiresAt,
      message: "License verified ✅",
    });
  } catch (err) {
    const msg = err?.message || String(err);
    const code = err?.code === "CORRUPTED" ? 500 : 500;
    return res.status(code).json({ status: "error", message: msg });
  }
});

export default router;
