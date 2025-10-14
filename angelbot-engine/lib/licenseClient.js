const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

async function pingLicenseServer(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/ping`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`License ping failed: HTTP ${res.status}`);

  const raw = await res.text();
  // 1) พยายาม parse JSON ก่อน
  try {
    const data = JSON.parse(raw);
    if (data && (data.ok === true || data.status === 'ok')) return true;
  } catch (_) {
    // 2) ถ้าไม่ใช่ JSON ให้เทียบเป็นข้อความ
    const txt = raw.trim().toLowerCase();
    if (txt === 'pong' || txt === 'ok') return true;
  }
  throw new Error(`Invalid license response: ${raw}`);
}

module.exports = { pingLicenseServer };
