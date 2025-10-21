// ======================================
// AngelBot UI — API helpers (fetch/SSE)
// ======================================
import type { Trade, BotState } from "./types";

export type Json<T = any> = { ok: boolean; data?: T; error?: string };

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  "http://127.0.0.1:3001";

function u(p: string) { return `${API_BASE}${p}`; }

async function parse<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  if (!res.ok) {
    const msg = isJson ? (await res.json()).error || res.statusText : await res.text();
    throw new Error(msg || `${res.status}`);
  }
  return (isJson ? res.json() : (await res.text())) as any;
}

async function get<T>(p: string)  { return parse<T>(await fetch(u(p), { cache: "no-store" })); }
async function post<T>(p: string, body?: any) {
  return parse<T>(await fetch(u(p), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }));
}

export const hasData = <T,>(x: Json<T>): x is Json<T> & { data: T } => x?.ok && "data" in x;

// ---------- Normalizers ----------
const toTrade = (t: any): Trade => ({
  id: Number(t.id),
  // number หรือ string → บังคับเป็น number (ms)
  timestamp: typeof t.timestamp === "number"
    ? t.timestamp
    : Date.parse(t.timestamp || new Date().toISOString()),
  asset: String(t.asset ?? t.symbol ?? ""),
  // บางเซิร์ฟเวอร์ส่ง side: BUY/SELL → map เป็น CALL/PUT
  direction: (t.direction ??
    (t.side ? (String(t.side).toUpperCase() === "BUY" ? "CALL" : "PUT") : "CALL")) as Trade["direction"],
  amount: Number(t.amount ?? t.size ?? 0),
  mgStep: Number(t.mgStep ?? 1),
  duration: String(t.duration ?? "1m"),
  // เซิร์ฟเวอร์เดิมอาจส่ง "DRAW" → UI ใช้ "EQUAL"
  result: (t.result === "DRAW" ? "EQUAL" : (t.result ?? "EQUAL")) as Trade["result"],
  result_pl: Number(t.result_pl ?? t.pnl ?? 0),
  strategy: String(t.strategy ?? "Baseline"),
});

// ---- health ----
export async function ping() {
  return get<{ ok: true; service: string }>("/health");
}

// ---- state / trades ----
export async function getState() {
  // พยายามอ่าน /state ก่อน แล้ว fallback ไป /engine/status
  try {
    const r = await get<{ ok: true; data: any }>("/state");
    const s = r.data || {};
    const statusTxt: BotState["status"] =
      (s.status as BotState["status"]) ??
      (s.running ? "running" : (s.paused ? "paused" : "stopped"));
    return {
      ok: true,
      data: {
        status: statusTxt,
        connected: !!s.connected,
        accountType: (s.accountType || "PRACTICE").toUpperCase() as BotState["accountType"],
        balance: s.balance,
      },
    } as Json<BotState>;
  } catch {
    const r = await get<{ ok: true; status: any }>("/engine/status");
    const s = r.status || {};
    const statusTxt: BotState["status"] =
      s.running ? "running" : (s.paused ? "paused" : "stopped");
    return {
      ok: true,
      data: {
        status: statusTxt,
        connected: !!s.connected,
        accountType: (s.account_type || "PRACTICE").toUpperCase() as BotState["accountType"],
        balance: s.balance,
      },
    } as Json<BotState>;
  }
}

export async function getTrades() {
  // รับได้ทั้ง /trades (ใหม่) และ /engine/trades (เก่า)
  try {
    const r = await get<{ ok: true; data: any[] }>("/trades?limit=500");
    const list = r.data ?? [];
    return { ok: true, data: list.map(toTrade) } as Json<Trade[]>;
  } catch {
    const r = await get<{ ok: true; trades: any[] }>("/engine/trades?limit=500");
    const list = r.trades ?? [];
    return { ok: true, data: list.map(toTrade) } as Json<Trade[]>;
  }
}

// ---- bot control ----
// เพิ่ม orderDuration ส่งไปกับ Start
export async function startBot(params?: {
  assetsCsv?: string;
  intervalMs?: number;
  amount?: number;
  orderDuration?: "1 Minute" | "3 Minutes" | "5 Minutes";
}) {
  return post<Json>("/bot/start", params ?? {});
}

export async function stopBot(){ return post<Json>("/bot/stop"); }
export async function pauseBot(){ return post<Json>("/bot/pause"); }
export async function resumeBot(){ return post<Json>("/bot/resume"); }
export async function resetData(){ return post<Json>("/bot/reset"); }

// ---- ส่งรายชื่อสินทรัพย์ไปเซิร์ฟเวอร์ (ไว้ใช้ตอน Resume) ----
export async function syncAssetsCsv(csv: string) {
  return post<Json>("/bot/assets", { assets: csv });
}

// ---- SSE ----
export function openTradesSSE(
  onOne: (t: Trade) => void,
  onSnapshot?: (list: Trade[]) => void,
  onOpen?: () => void,
  onError?: (err?: unknown) => void
): () => void {
  const tryOpen = (path: string) => {
    const src = new EventSource(u(path)); // no credentials → CORS-free
    src.onopen = () => { try { onOpen?.(); } catch {} };

    src.addEventListener("snapshot", (ev: MessageEvent) => {
      if (!onSnapshot) return;
      try {
        const raw = JSON.parse(ev.data) as any[];
        onSnapshot(Array.isArray(raw) ? raw.map(toTrade) : []);
      } catch {}
    });

    src.addEventListener("trade", (ev: MessageEvent) => {
      try { onOne(toTrade(JSON.parse(ev.data))); } catch {}
    });

    src.onerror = (e) => { try { onError?.(e); } catch {} };
    return src;
  };

  // ใช้ endpoint ใหม่ก่อน แล้ว fallback ไปของเก่าอัตโนมัติ
  let switched = false;
  let es = tryOpen("/trades/stream");
  es.onerror = (e) => {
    if (!switched) {
      switched = true;
      try { es.close(); } catch {}
      es = tryOpen("/engine/sse");
    }
    try { onError?.(e); } catch {}
  };

  return () => { try { es.close(); } catch {} };
}
