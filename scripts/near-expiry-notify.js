// scripts/near-expiry-notify.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyFile, findLatestFile } from "./verify-local-license.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LICENSE_DIR = path.resolve(__dirname, "../server/licenses");
const NEAR_DAYS = Number(process.env.LICENSE_NEAR_DAYS || 7);

(async () => {
  const latest = await findLatestFile(LICENSE_DIR);
  if (!latest) {
    console.warn("⚠️ no license found to check.");
    process.exit(0);
  }
  const v = await verifyFile(latest, { requireChecksum: true, nearDays: NEAR_DAYS });
  if (v.nearExpiry) {
    console.warn(`🔔 License near expiry in ~${v.daysLeft} day(s).`);
  } else if (!v.expiryOk) {
    console.error("❌ License expired.");
  } else {
    console.log("✅ License expiry OK.");
  }
  process.exit(0);
})();
