// src/api.ts
// รองรับทั้ง proxy (Vite dev server) และ BASE URL จาก .env.local
// รวม endpoint ใหม่/เก่า พร้อม fallback อัตโนมัติ + timeout + abort

import type { EngineStatus, Trade } from "./types";

type Ok<T = {}> = { ok: true } & T;
type Err = { ok: false; error?: string; detail?: string };

// ถ้าไม่ตั้งค่า VITE_ENGINE_URL จะยิงหา path เดิม (ให้ proxy จัดการ)
const BASE = (import.meta.env.VITE_ENGINE_URL ?? "").trim();
const makeUrl = (path: string) => (BASE ? `${BASE}${path}` : path);

// ─────────────────────────────────────────────────────────────
// helpers: fetch + timeout + safe JSON + multi-path fallback
// ─────────────────────────────────────────────────────────────
async function requestOne<T>(
  path: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 10_000, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(makeUrl(path), { ...init, signal: controller.signal });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(
        `HTTP ${res.status} ${res.statusText}${text ? ` - ${text.slice(0, 200)}` : ""}`
      );
      (err as any)._status = res.status; // ให้ caller ตัดสินใจว่าจะ fallback ต่อไหม
      throw err;
    }

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return (await res.json()) as T;
    }
    const txt = await res.text();
    try {
      return JSON.parse(txt) as T;
    } catch {
      return txt as unknown as T;
    }
  } finally {
    clearTimeout(timer);
  }
}

/** ลองยิงทีละ path จนกว่าจะสำเร็จ
 *  - ข้ามต่อเมื่อ error เป็น 404/405/501 (resource/method ไม่ตรง)
 *  - error อื่น ๆ โยนกลับทันที (เช่น 500/502/timeout)
 */
async function request<T>(
  paths: string | string[],
  opts?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const arr = Array.isArray(paths) ? paths : [paths];
  let lastErr: any = null;

  for (const p of arr) {
    try {
      return await requestOne<T>(p, opts);
    } catch (e: any) {
      lastErr = e;
      const st = e?._status as number | undefined;
      if (st === 404 || st === 405 || st === 501) {
        continue; // ลอง path ถัดไป
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("All endpoints failed");
}

// ─────────────────────────────────────────────────────────────
// Engine endpoints (มี fallback รูปแบบเก่าให้ด้วย)
// หมายเหตุ: บางฟังก์ชันรีเทิร์นแบบ Ok{...} เพื่อให้ App เลือก unwrap เองได้
// ─────────────────────────────────────────────────────────────

export async function getStatus(): Promise<Ok<{ status: EngineStatus }> | EngineStatus> {
  // บาง backend คืน { ok, status }, บางตัวคืน EngineStatus ตรง ๆ
  return request<Ok<{ status: EngineStatus }> | EngineStatus>(
    ["/engine/status", "/api/status", "/status"],
    { cache: "no-store" }
  );
}

export async function startEngine(): Promise<Ok | Err> {
  return request<Ok | Err>(["/engine/start", "/api/start", "/start"], {
    method: "POST",
  });
}

export async function stopEngine(): Promise<Ok | Err> {
  return request<Ok | Err>(["/engine/stop", "/api/stop", "/stop"], {
    method: "POST",
  });
}

/** ส่งสัญญาณสั่งออเดอร์แบบด่วน (ไม่เปลี่ยน engine state)
 *  ฝั่ง server.mjs รองรับ qty/amount/quantity/size → normalize เป็น qty
 *  ตรงนี้ยังส่งเป็น size เพื่อเข้ากับเวอร์ชันเก่าที่พี่มี
 */
export async function sendSignal(data: {
  symbol: string;
  side: "BUY" | "SELL";
  size: number;      // ใช้ 'size' แต่ฝั่ง server จะ map เป็น qty ให้
  price?: number;
  owner?: string;
  note?: string;
}): Promise<Ok<{ placed?: Trade; trade?: Trade }> | Err> {
  // ลำดับ fallback: ใหม่ -> เดิมที่เป็น /api/order -> เดิมสุด /order
  return request<Ok<{ placed?: Trade; trade?: Trade }> | Err>(
    ["/engine/signal", "/api/order", "/order"],
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    }
  );
}

/** alias ที่อ่านง่ายสำหรับปุ่ม Quick BUY/SELL */
export function quickOrder(
  side: "BUY" | "SELL",
  symbol: string,
  amount: number,
  price?: number
) {
  return sendSignal({ side, symbol, size: amount, price, owner: "ui", note: "quick" });
}

/** ดึง trades (ล่าสุดก่อน) */
export async function getTrades(limit = 20): Promise<Ok<{ trades: Trade[] }> | Trade[]> {
  const q = `?limit=${encodeURIComponent(limit)}`;
  return request<Ok<{ trades: Trade[] }> | Trade[]>(
    [`/engine/trades${q}`, `/api/trades${q}`, `/trades${q}`],
    { cache: "no-store" }
  );
}

/** เคลียร์ trade history (ถ้าฝั่ง server รองรับ) */
export async function clearTrades(): Promise<Ok | Err> {
  return request<Ok | Err>(["/engine/trades/clear", "/api/trades/clear", "/trades/clear"], {
    method: "POST",
  });
}

/** ดาวน์โหลด CSV (ถ้าฝั่ง server เปิด route ไว้) */
export async function downloadTradesCsv(): Promise<Blob> {
  const paths = ["/engine/trades.csv", "/api/trades.csv", "/trades.csv"];
  let lastErr: any = null;

  for (const p of paths) {
    try {
      const res = await fetch(makeUrl(p));
      if (!res.ok) {
        lastErr = new Error(`downloadTradesCsv failed: ${res.status}`);
        continue;
      }
      return await res.blob();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("downloadTradesCsv: all paths failed");
}

/** ping/health (มี fallback ให้หลายแบบ) */
export async function pingHealth(): Promise<any> {
  try {
    return await request<any>(["/health", "/api/ping", "/engine/health"], {
      cache: "no-store",
      timeoutMs: 5_000,
    });
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
