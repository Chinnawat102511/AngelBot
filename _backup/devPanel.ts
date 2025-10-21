// src/boot/devPanel.ts
// Dev panel แบบลอยทับหน้า: กดได้แน่นอน ยิง /api/* โดยตรง + ตัดเลขท้ายอัตโนมัติ

function normalize(path: string) {
  const base = '/api';
  const cleaned = path.replace(/\/([A-Za-z_-]+?)(\d+)(?=\/|$)/g, '/$1');
  const full = cleaned.startsWith('/api') ? cleaned : base + cleaned;
  return full;
}

async function hit(path: string, method: 'GET' | 'POST' = 'GET', body?: any) {
  const url = normalize(path);
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    credentials: 'include',
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  console.log(`[DEV] ${method} ${url} ->`, res.status, data);
  return data;
}

function btn(label: string, onClick: () => void) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.margin = '0 6px 6px 0';
  b.style.padding = '6px 10px';
  b.style.borderRadius = '10px';
  b.style.border = '1px solid #ddd';
  b.style.background = '#fff';
  b.style.cursor = 'pointer';
  b.style.fontSize = '12px';
  b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
  return b;
}

function mountPanel() {
  // ถ้ามีแล้วไม่ต้องสร้างซ้ำ
  if (document.getElementById('angel-dev-panel')) return;

  const box = document.createElement('div');
  box.id = 'angel-dev-panel';
  box.style.position = 'fixed';
  box.style.top = '12px';
  box.style.right = '12px';
  box.style.zIndex = '999999';
  box.style.background = 'rgba(250,250,250,0.95)';
  box.style.border = '1px solid #e5e7eb';
  box.style.borderRadius = '14px';
  box.style.boxShadow = '0 6px 18px rgba(0,0,0,0.1)';
  box.style.padding = '10px';
  box.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
  box.style.userSelect = 'none';

  const title = document.createElement('div');
  title.textContent = 'Dev Controls';
  title.style.fontSize = '12px';
  title.style.opacity = '0.7';
  title.style.marginBottom = '6px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';

  row.append(
    btn('Start',  () => hit('/start',  'POST').then(() => hit('/state'))),
    btn('Pause',  () => hit('/pause',  'POST').then(() => hit('/state'))),
    btn('Resume', () => hit('/resume', 'POST').then(() => hit('/state'))),
    btn('Stop',   () => hit('/stop',   'POST').then(() => hit('/state'))),
    btn('Reset',  () => hit('/reset',  'POST').then(() => hit('/state'))),
  );

  const sse = document.createElement('div');
  sse.style.marginTop = '6px';
  sse.style.fontSize = '11px';
  sse.style.opacity = '0.7';
  sse.textContent = 'SSE: connecting…';

  // เช็ค quotes SSE ให้แน่ใจว่าทำงาน
  try {
    const es = new EventSource(normalize('/quotes/stream?symbols=XAUUSD,EURUSD'));
    es.addEventListener('quotes', (e: MessageEvent) => {
      sse.textContent = 'SSE: connected';
      sse.style.opacity = '1';
      // console.log('[DEV] quotes', JSON.parse(e.data));
    });
    es.onerror = () => { sse.textContent = 'SSE: error'; };
  } catch {}

  box.append(title, row, sse);
  document.body.appendChild(box);
  console.log('[DEV] AngelDevPanel ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPanel);
} else {
  mountPanel();
}
