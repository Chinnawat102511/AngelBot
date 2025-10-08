// scripts/stop-server.js
// หยุด License Server โดยค้นหา PID จากพอร์ต (default 3001)
// Robust: ใช้ PowerShell ก่อน แล้วค่อย fallback netstat; ไม่เจอถือว่าสำเร็จแบบ no-op

import { exec } from "node:child_process";
import { promisify } from "node:util";

const sh = promisify(exec);
const PORT = Number(process.env.LICENSE_PORT || 3001);

async function tryExec(cmd) {
  try {
    const { stdout } = await sh(cmd);
    return (stdout || "").trim();
  } catch (e) {
    // บางคำสั่งคืน exitCode=1 เมื่อ "ไม่พบ" -> ให้ถือว่า stdout ว่าง
    return "";
  }
}

// ---- Windows helpers -------------------------------------------------------
async function pidsFromPowerShell(port) {
  // ดึง PID ที่ LISTEN บนพอร์ตนั้น ๆ (unique)
  const cmd =
    `powershell -NoProfile -Command "` +
    `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ` +
    `Select-Object -ExpandProperty OwningProcess | Select-Object -Unique) -join ' '"`;
  const out = await tryExec(cmd);
  return out ? out.split(/\s+/).filter(Boolean) : [];
}

async function pidsFromNetstat(port) {
  // กรอง LISTENING เท่านั้น
  const out = await tryExec(`cmd /c "netstat -ano | findstr LISTENING | findstr :${port}"`);
  if (!out) return [];
  const lines = out.split(/\r?\n/).filter(Boolean);
  const pids = new Set();
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    const pid = cols[cols.length - 1];
    if (pid) pids.add(pid);
  }
  return Array.from(pids);
}

async function stopWindows(port) {
  // 1) PowerShell
  let pids = await pidsFromPowerShell(port);
  // 2) fallback netstat
  if (pids.length === 0) pids = await pidsFromNetstat(port);

  if (pids.length === 0) {
    console.log(`ℹ️  ไม่พบโปรเซสที่ฟังพอร์ต ${port} (Windows)`);
    return true; // no-op แต่ถือว่าสำเร็จ
  }

  let ok = true;
  for (const pid of pids) {
    try {
      console.log(`🛑 taskkill /PID ${pid} /F`);
      await sh(`taskkill /PID ${pid} /F`);
    } catch (e) {
      ok = false;
      console.warn(`⚠️  ฆ่า PID ${pid} ไม่สำเร็จ: ${e.message}`);
    }
  }
  return ok;
}

// ---- Unix helpers ----------------------------------------------------------
async function stopUnix(port) {
  // lsof อาจไม่มีในบางเครื่อง -> ถ้าไม่มีให้ถือว่า no-op
  const out = await tryExec(`bash -lc "command -v lsof >/dev/null 2>&1 && lsof -ti :${port} || true"`);
  const pids = out ? out.split(/\s+/).filter(Boolean) : [];
  if (pids.length === 0) {
    console.log(`ℹ️  ไม่พบโปรเซสที่ฟังพอร์ต ${port} (Unix)`);
    return true;
  }
  let ok = true;
  for (const pid of pids) {
    try {
      console.log(`🛑 kill -9 ${pid}`);
      await sh(`kill -9 ${pid}`);
    } catch (e) {
      ok = false;
      console.warn(`⚠️  ฆ่า PID ${pid} ไม่สำเร็จ: ${e.message}`);
    }
  }
  return ok;
}

// ---- main ------------------------------------------------------------------
(async () => {
  console.log(`🔎 กำลังหยุด License Server บนพอร์ต ${PORT} ...`);
  const isWin = process.platform === "win32";
  const ok = isWin ? await stopWindows(PORT) : await stopUnix(PORT);
  if (ok) {
    console.log("✅ ปิดเซิร์ฟเวอร์เรียบร้อย (หรือไม่มีอะไรให้ปิด)");
    process.exit(0);
  } else {
    console.error("❌ stop-server มีบาง PID ปิดไม่สำเร็จ");
    process.exit(1);
  }
})().catch((e) => {
  console.error("❌ stop-server ล้มเหลว:", e);
  process.exit(1);
});
