// compatRoutes.js — A3 (Spec aliases + rich stubs)
const fs = require('fs');
const path = require('path');
const os = require('os');

function readLatestLicense(licenseDir) {
  try {
    if (!licenseDir || !fs.existsSync(licenseDir)) return null;
    const files = fs.readdirSync(licenseDir)
      .filter(f => /^license_output_.*\.json$/i.test(f))
      .map(f => ({ f, t: fs.statSync(path.join(licenseDir, f)).mtimeMs }))
      .sort((a,b)=>a.t-b.t);
    if (!files.length) return null;
    const latestPath = path.join(licenseDir, files.at(-1).f);
    const data = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    return { path: latestPath, data };
  } catch { return null; }
}

function toCsv(rows) {
  const header = 'ts,asset,dir,stake,step,result,pnl,reason\n';
  const lines = rows.map(t =>
    [t.ts, t.asset, t.dir, t.stake, t.step, t.result, t.pnl, (t.reason||'')].join(',')
  ).join('\n');
  return header + lines + (rows.length ? '\n' : '');
}

module.exports = function attachCompat(app, opts = {}) {
  const LICENSE_DIR = opts.licenseDir || process.env.LICENSE_DIR || path.join(process.cwd(), 'license');
  const EXPORT_DIR  = opts.exportDir  || path.join(process.cwd(), 'exports');
  if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

  // -------- In-memory state (เบา ๆ) --------
  let connected = false;
  let running   = false;
  let session   = {
    orders: 0, w: 0, l: 0, d: 0, pnl: 0,
    maxMG: 0, step: 1, payout: 0.82,
    startedAt: null, lastActionAt: null
  };
  const trades = [];                              // recent buffer (UI)
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const tradeLogFile = path.join(logsDir, `trades-${new Date().toISOString().slice(0,10)}.log`);

  const indicators = { '1m': {}, '5m': {} };
  const ai = { '1m': { conf: 0.58, gap: 0.31 }, '5m': { conf: 0.61, gap: 0.27 } };

  const stamp = () => new Date().toISOString();
  const pushTrade = (t) => {
    trades.push(t);
    if (trades.length > 2000) trades.shift();
    try { fs.appendFileSync(tradeLogFile, JSON.stringify(t) + '\n', 'utf8'); } catch {}
  };

  // -------- Core / Health / License --------
  app.get('/status', (req, res) => {
    res.json({ ok: true, connected, running, session });
  });

  app.post('/license/check', (req, res) => {
    const found = readLatestLicense(LICENSE_DIR);
    let daysLeft = 30, holder = 'AngelTeam', pathStr = path.join(LICENSE_DIR, 'license_output_id.json');
    if (found) {
      pathStr = found.path;
      holder = found.data?.licenses?.holder || found.data?.holder || holder;
      // คำนวณ daysLeft ถ้ามี issuedAt + ttlDays
      const issued = found.data?.licenses?.issuedAt || found.data?.issuedAt;
      const ttl    = Number(found.data?.licenses?.ttlDays || found.data?.ttlDays || 30);
      if (issued) {
        try {
          const exp = new Date(issued); exp.setUTCMinutes(exp.getUTCMinutes() + ttl*24*60);
          daysLeft = Math.max(0, Math.ceil((exp - new Date()) / 86400000));
        } catch {}
      }
    }
    res.json({ ok: true, license: { valid: true, holder, daysLeft, path: pathStr }});
  });

  app.get('/system/hwid', (req, res) => {
    const hwid = [os.hostname(), os.platform(), os.arch()].join('-');
    res.json({ ok: true, hwid });
  });

  // -------- Connection / Bot Control --------
  app.post('/connect', (req, res) => {
    const { email, password, account_type } = req.body || {};
    connected = true;
    res.json({ ok: true, connected, email, account_type });
  });

  app.post('/bot/start', (req, res) => {
    if (!connected) return res.status(400).json({ ok:false, error:'not_connected' });
    running = true;
    session.startedAt   = session.startedAt || stamp();
    session.lastActionAt= stamp();
    res.json({ ok: true, running });
  });

  app.post('/bot/stop', (req, res) => {
    running = false;
    session.lastActionAt = stamp();
    res.json({ ok: true, running });
  });

  // -------- Trades (stubs เติมรายละเอียด) --------
  app.get('/trades', (req, res) => {
    const limit = Math.max(1, Math.min(2000, Number(req.query.limit || 100)));
    res.json({ ok: true, rows: trades.slice(-limit) });
  });

  // สำหรับทดสอบเติมข้อมูลเร็ว ๆ (dev only)
  app.post('/trades/mock', (req, res) => {
    const { asset='EURUSD', dir='PUT', stake=5, step=session.step||1, result='WIN', pnl=4.1, reason='mock' } = req.body || {};
    const row = { ts: stamp(), asset, dir, stake, step, result, pnl, reason };
    // อัปเดต session
    session.orders += 1;
    session.maxMG   = Math.max(session.maxMG, step);
    if (result === 'WIN') session.w += 1;
    else if (result === 'LOSE') session.l += 1;
    else session.d += 1;
    session.pnl = Number((session.pnl + Number(pnl || 0)).toFixed(2));
    session.lastActionAt = stamp();
    pushTrade(row);
    res.json({ ok: true, row, session });
  });

  app.post('/trades/export', (req, res) => {
    try {
      const name = `trades_${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.csv`;
      const filePath = path.join(EXPORT_DIR, name);
      fs.writeFileSync(filePath, toCsv(trades), 'utf8');
      res.json({ ok: true, url: `/download/${name}` });
    } catch (e) {
      res.status(500).json({ ok:false, error:'export_failed' });
    }
  });

  // เสิร์ฟไฟล์ export แบบง่าย
  app.get('/download/:file', (req, res) => {
    const p = path.join(EXPORT_DIR, req.params.file);
    if (fs.existsSync(p)) return res.download(p);
    res.status(404).json({ ok:false, error:'not_found' });
  });

  // -------- Indicators --------
  app.get('/indicators/get', (req, res) => res.json({ ok:true, config: indicators }));
  app.post('/indicators/set', (req, res) => {
    const { tf, config } = req.body || {};
    if (!tf) return res.status(400).json({ ok:false, error:'invalid_payload' });
    indicators[tf] = config || {};
    res.json({ ok:true });
  });
  app.post('/indicators/live', (req, res) => {
    const { asset='EURUSD', tf='1m' } = req.body || {};
    res.json({ ok:true, asset, tf, snapshot: { rsi: 48, macd: -0.01, maTrend: 'flat' }});
  });

  // -------- AI --------
  app.get('/ai/status', (req, res) => {
    const tf = (req.query.tf || '1m').toString();
    const s = ai[tf] || ai['1m'];
    res.json({ ok:true, tf, conf: s.conf, gap: s.gap });
  });
  app.post('/ai/auto',       (req,res)=> res.json({ ok:true }));
  app.post('/ai/retrain',    (req,res)=> res.json({ ok:true }));
  app.post('/ai/calibrate',  (req,res)=> res.json({ ok:true }));

  // -------- Market / System --------
  app.get('/market-hours', (req, res) => res.json({ ok:true, hours: { mon_fri:'24h', weekend:'off' }}));
  app.post('/system/shutdown', (req, res) => res.json({ ok:true, accepted:true }));
};
