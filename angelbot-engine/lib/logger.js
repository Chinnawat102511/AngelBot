// angelbot-engine/lib/logger.js
// ใช้ได้ทั้งกับ CommonJS และระบบไฟล์ Node v20+

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

class Logger {
  constructor(baseDir = path.join(process.cwd(), 'logs')) {
    this.baseDir = baseDir;
    ensureDir(baseDir);
  }

  filePath() {
    return path.join(this.baseDir, `trades-${today()}.log`);
  }

  // ---- แกนกลาง: เขียน log ลงไฟล์และแสดงบน console ----
  write(level, ...args) {
  const formatted = args.map(a =>
    typeof a === 'object' ? JSON.stringify(a, null, 2) : a
  );
  const line = `[${new Date().toISOString()}] [${level}] ${formatted.join(' ')}`;
  console.log(line);
  try {
    fs.appendFileSync(this.filePath(), line + '\n', { encoding: 'utf8' });
  } catch (err) {
    console.error('[Logger] Failed to write log file:', err.message);
  }
}

  // ---- เมธอดย่อยที่โค้ดอื่นเรียก ----
  info(...args)  { this.write('INFO', ...args); }
  warn(...args)  { this.write('WARN', ...args); }
  error(...args) { this.write('ERROR', ...args); }
  debug(...args) { this.write('DEBUG', ...args); }
  log(...args)   { this.write('LOG', ...args); }
}

module.exports = { Logger };
