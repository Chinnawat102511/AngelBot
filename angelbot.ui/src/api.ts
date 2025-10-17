// ======================================
// AngelBot UI — API helpers (fetch/SSE)
// ======================================
import type { ApiResponse, BotConfig, BotState, Trade } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function parseJsonSafe<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const b = await res.json();
      if ((b as any)?.error) msg = (b as any).error;
    } catch {
      try { msg = await res.text(); } catch {}
    }
    throw new Error(msg);
  }
  return parseJsonSafe<T>(res);
}

// ---- health ----
export async function ping(): Promise<{ pong: boolean }> {
  return j<{ pong: boolean }>("/ping");
}

// ---- state / trades ----
export async function getState(): Promise<ApiResponse<BotState>> {
  return j<ApiResponse<BotState>>("/state");
}
export async function getTrades(): Promise<ApiResponse<Trade[]>> {
  return j<ApiResponse<Trade[]>>("/trades");
}

// ---- bot control ----
export async function startBot(
  conn: { email: string; password: string; accountType: "PRACTICE" | "REAL" },
  cfg: BotConfig
): Promise<ApiResponse<BotState>> {
  return j<ApiResponse<BotState>>("/bot/start", {
    method: "POST",
    body: JSON.stringify({ conn, cfg }),
  });
}
export async function stopBot(): Promise<ApiResponse<BotState>> {
  return j<ApiResponse<BotState>>("/bot/stop", { method: "POST" });
}
export async function pauseBot(): Promise<ApiResponse<BotState>> {
  return j<ApiResponse<BotState>>("/bot/pause", { method: "POST" });
}
export async function resumeBot(): Promise<ApiResponse<BotState>> {
  return j<ApiResponse<BotState>>("/bot/resume", { method: "POST" });
}
export async function resetData(): Promise<ApiResponse<boolean>> {
  return j<ApiResponse<boolean>>("/bot/reset", { method: "POST" });
}

// ---- SSE ----
export function openTradesSSE(
  onTrade: (t: Trade) => void,
  onSnapshot?: (list: Trade[]) => void
) {
  const es = new EventSource(`${BASE}/trades/stream`, { withCredentials: true });
  es.addEventListener("trade", (e) => {
    try { onTrade(JSON.parse((e as MessageEvent).data) as Trade); } catch {}
  });
  es.addEventListener("snapshot", (e) => {
    if (!onSnapshot) return;
    try { onSnapshot(JSON.parse((e as MessageEvent).data) as Trade[]); } catch {}
  });
  es.onerror = () => { /* auto-reconnect by browser */ };
  return () => es.close();
}

// ---- type guard ----
export function hasData<T>(r: ApiResponse<T>): r is { ok: true; data: T } {
  return !!(r && r.ok && r.data !== undefined && r.data !== null);
}
