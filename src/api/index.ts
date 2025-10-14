// src/api/index.ts
import type { Trade, EngineStatus } from '../types';

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error?: string };

const BASE = (import.meta as any)?.env?.VITE_ENGINE_URL?.trim?.() ?? '';
const makeUrl = (p: string) => (BASE ? `${BASE}${p}` : p);

// ---- internal fetch with timeout + JSON ----
async function requestOne<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 10000, ...opts } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(makeUrl(path), { ...opts, signal: controller.signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` - ${txt.slice(0, 200)}` : ''}`);
      (err as any)._status = res.status;
      throw err;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json() as Promise<T>;
    const text = await res.text();
    try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(
  paths: string | string[],
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const list = Array.isArray(paths) ? paths : [paths];
  let last: any = null;
  for (const p of list) {
    try { return await requestOne<T>(p, init); }
    catch (e: any) {
      last = e;
      const st = e?._status;
      if (st === 404 || st === 405 || st === 501) continue; // try next path
      throw e;
    }
  }
  throw last ?? new Error('All endpoints failed');
}

// ---- exported API (used in Dashboard.tsx) ----
export async function getStatus(): Promise<Ok<{ status: EngineStatus }>> {
  return request<Ok<{ status: EngineStatus }>>(
    ['/engine/status', '/api/status', '/status'],
    { cache: 'no-store' }
  );
}

export async function startEngine(): Promise<Ok<{}> | Err> {
  return request<Ok<{}> | Err>(
    ['/engine/start', '/api/start', '/start'],
    { method: 'POST' }
  );
}

export async function stopEngine(): Promise<Ok<{}> | Err> {
  return request<Ok<{}> | Err>(
    ['/engine/stop', '/api/stop', '/stop'],
    { method: 'POST' }
  );
}

export async function quickOrder(
  side: 'BUY' | 'SELL',
  symbol: string,
  amount: number,
  price?: number
): Promise<Ok<{ placed: Trade }> | Err> {
  return request<Ok<{ placed: Trade }> | Err>(
    ['/engine/signal', '/api/order', '/order'],
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side, symbol, size: amount, price }),
    }
  );
}

export async function getTrades(limit = 100): Promise<Ok<{ trades: Trade[] }>> {
  const q = `?limit=${encodeURIComponent(limit)}`;
  return request<Ok<{ trades: Trade[] }>>(
    [`/engine/trades${q}`, `/api/trades${q}`, `/trades${q}`],
    { cache: 'no-store' }
  );
}

export async function clearTrades(): Promise<Ok<{}> | Err> {
  return request<Ok<{}> | Err>(
    ['/engine/trades/clear', '/api/trades/clear', '/trades/clear'],
    { method: 'POST' }
  );
}

export async function pingHealth(): Promise<any> {
  try {
    return await request<any>(['/health', '/api/ping', '/engine/health'], {
      cache: 'no-store',
      timeoutMs: 5000,
    });
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
