// scripts/issue-and-upload.js
// One-click: generate a new license then POST it to /api/license/upload

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import fetch from "node-fetch";

const root = process.cwd();
const LICENSE_DIR = path.join(root, "server", "licenses");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const [k, v] = a.split("=");
      if (v !== undefined) out[k.slice(2)] = v;
      else out[a.slice(2)] = args[i + 1], i++;
    }
  }
  return {
    days: Number(out.days ?? process.env.LICENSE_RENEW_DAYS ?? 30),
    owner: out.owner ?? process.env.LICENSE_OWNER ?? "AngelTeam",
    plan: out.plan ?? process.env.LICENSE_PLAN ?? "pro",
    base: out.base ?? process.env.VITE_LICENSE_BASE_URL ?? "http://localhost:3001",
  };
}

function findLatestJson(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
  if (!files.length) return null;
  const latest = files
    .map(name => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  return path.join(dir, latest.name);
}

async function main() {
  const { days, owner, plan, base } = parseArgs();

  console.log(`\n▶ Generating license: owner=${owner}, plan=${plan}, days=${days}`);
  const gen = spawnSync(
    process.execPath,
    [path.join("scripts", "generate-license.js"), "--days", String(days), "--owner", owner, "--plan", plan],
    { stdio: "inherit" }
  );
  if (gen.status !== 0) {
    console.error("❌ generate-license.js failed"); process.exit(1);
  }

  const latestPath = findLatestJson(LICENSE_DIR);
  if (!latestPath) {
    console.error("❌ No license file found in server/licenses after generate.");
    process.exit(1);
  }

  const json = JSON.parse(fs.readFileSync(latestPath, "utf8"));
  const url = `${base.replace(/\/+$/,"")}/api/license/upload`;

  console.log(`\n▶ Uploading to ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`❌ Upload failed ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  if (data?.ok) {
    console.log("✅ Upload success:", data);
  } else {
    console.log("⚠️ Server response:", data);
  }
}

main().catch(err => {
  console.error("❌ issue-and-upload error:", err);
  process.exit(1);
});
