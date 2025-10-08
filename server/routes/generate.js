// server/routes/generate.js
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const LICENSE_DIR = path.resolve("server/licenses");
const SECRET = process.env.LICENSE_SECRET || "dev-secret";

// === util ===
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

function calcChecksum(payload) {
  return crypto.createHmac("sha256", SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
}

function createLicense({ owner, days, plan = "pro" }) {
  const id = crypto.randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + days * 86400_000);
  const payload = {
    v: 1,
    id,
    owner,
    plan,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    features: ["angelbot", "forecast"],
  };
  const checksum = calcChecksum(payload);
  const license = { ...payload, checksum };

  fs.mkdirSync(LICENSE_DIR, { recursive: true });
  const file = path.join(LICENSE_DIR, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(license, null, 2), "utf8");

  return license;
}

// === route ===
router.post("/", (req, res) => {
  try {
    const { owner, days, plan } = req.body || {};
    if (!owner || !days)
      return res.status(400).json({ error: "owner and days are required" });

    const lic = createLicense({ owner, days: Number(days), plan });
    res.json({ status: "ok", license: lic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
