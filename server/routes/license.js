const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = Router();
const storePath = path.resolve(process.cwd(), 'license', 'data', 'licenses.json');
fs.mkdirSync(path.dirname(storePath), { recursive: true });
if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, '[]', 'utf8');

function load() {
  return JSON.parse(fs.readFileSync(storePath, 'utf8'));
}
function save(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
}
function now() { return new Date(); }
function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function toISO(d) { return new Date(d).toISOString(); }
function genKey() { return crypto.randomBytes(16).toString('hex'); }

router.post('/issue', (req, res) => {
  const { owner, plan = 'pro', days = 30 } = req.body || {};
  if (!owner) return res.status(400).json({ ok: false, error: 'owner required' });

  const db = load();
  const key = genKey();
  const issuedAt = now();
  const expiresAt = addDays(issuedAt, Number(days));

  const row = { key, owner, plan, issuedAt: toISO(issuedAt), expiresAt: toISO(expiresAt), status: 'active' };
  db.push(row);
  save(db);
  return res.json({ ok: true, license: row });
});

router.post('/verify', (req, res) => {
  const { key, owner } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, error: 'key required' });
  const db = load();
  const row = db.find(r => r.key === key && (!owner || r.owner === owner));
  if (!row) return res.json({ ok: false, valid: false, reason: 'not_found' });

  const nowTs = now().getTime();
  const expTs = new Date(row.expiresAt).getTime();
  const valid = row.status === 'active' && expTs >= nowTs;
  const daysLeft = Math.ceil((expTs - nowTs) / (1000*60*60*24));
  return res.json({ ok: true, valid, daysLeft, license: row });
});

router.post('/refresh', (req, res) => {
  const { key, extendDays = 30 } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, error: 'key required' });

  const db = load();
  const idx = db.findIndex(r => r.key === key);
  if (idx < 0) return res.json({ ok: false, refreshed: false, reason: 'not_found' });

  const row = db[idx];
  const nowTs = now().getTime();
  const expTs = new Date(row.expiresAt).getTime();

  if (expTs < nowTs) return res.json({ ok: false, refreshed: false, reason: 'expired' });

  const refreshedExp = addDays(new Date(row.expiresAt), Number(extendDays));
  row.expiresAt = toISO(refreshedExp);
  db[idx] = row;
  save(db);
  return res.json({ ok: true, refreshed: true, license: row });
});

module.exports = router;
