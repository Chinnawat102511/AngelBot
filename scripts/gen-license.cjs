#!/usr/bin/env node
// CommonJS version (ใช้กับ package.json ที่ "type":"module")
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const [owner, daysStr, plan = "pro"] = process.argv.slice(2);
if (!owner || !daysStr) {
  console.error("Usage: scripts\\gen-license.bat <owner> <days> [plan]");
  process.exit(1);
}
const days = parseInt(daysStr, 10);
if (!Number.isFinite(days) || days <= 0) {
  console.error("days must be a positive integer");
  process.exit(1);
}

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

const secret = process.env.LICENSE_SECRET || "dev-secret";
const checksum = crypto
  .createHmac("sha256", secret)
  .update(JSON.stringify(payload))
  .digest("hex");

const license = { ...payload, checksum };

const outDir = path.resolve(__dirname, "..", "server", "licenses");
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, `${id}.json`);
fs.writeFileSync(outPath, JSON.stringify(license, null, 2), "utf8");

console.log("[ok] License saved:", outPath);
console.log(JSON.stringify(license, null, 2));
