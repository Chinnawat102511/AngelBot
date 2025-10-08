// src/lib/api.ts
// lightweight API client with nice errors + license handling

// ---------- Error types ----------
export class LicenseError extends Error {
  code = "license_expired";
  constructor(message = "License expired or invalid. Please upload a new license.") {
    super(message);
    this.name = "LicenseError";
  }
}

export function isLicenseError(e: unknown): e is LicenseError {
  return e instanceof LicenseError || (typeof e === "object" && !!e && (e as any).code === "license_expired");
}

// ---------- base url & url builder ----------
/** Base URL ของเซิร์ฟเวอร์ (ใช้ Vite env ถ้ามี) */
export function apiBase(): string {
  const base =
    (import.meta as any)?.env?.VITE_LICENSE_BASE_URL ||
    (typeof process !== "undefined" && (process as any).env?.VITE_LICENSE_BASE_URL) ||
    "http://localhost:3001";
  // ตัดท้าย "/" กันพลาด
  return String(base).replace(/\/+$/, "");
}

/** สร้าง URL จาก path (รองรับ query object) */
export function buildUrl(path: string, query?: Record<string, any>): string {
  const base = apiBase();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

// ---------- response handling ----------
/** จัดการ response + โยน error ที่อ่านง่าย (โดยเฉพาะ license 403) */
async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // ไม่เป็นไร ถ้าไม่ใช่ JSON
  }

  if (res.status === 403 && (data?.error === "license_expired" || data?.message?.toLowerCase?.().includes("license"))) {
    const err = new LicenseError(data?.message);
    (err as any).code = "license_expired";
    throw err;
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `API error ${res.status}: ${res.statusText}`;
    const e = new Error(message);
    (e as any).status = res.status;
    (e as any).payload = data;
    throw e;
  }

  return (data as T) ?? ({} as T);
}

/** timeout ด้วย AbortController (เลือกใส่ได้) */
function withTimeout(init?: RequestInit, ms?: number): { init: RequestInit; controller?: AbortController } {
  if (!ms || ms <= 0) return { init: init || {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const composed: RequestInit = { ...(init || {}), signal: controller.signal };
  // cleanup เมื่อ fetch จบ
  (composed as any).__cancelTimeout = () => clearTimeout(timer);
  return { init: composed, controller };
}

// ---------- HTTP helpers ----------
/** เรียก GET */
export async function get<T>(path: string, query?: Record<string, any>, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const url = buildUrl(path, query);
  const { init: i } = withTimeout({ ...(init || {}), method: "GET" }, timeoutMs);
  const res = await fetch(url, i);
  (i as any).__cancelTimeout?.();
  return handleResponse<T>(res);
}

/** เรียก POST (JSON) */
export async function postJson<T>(path: string, body: unknown, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const url = buildUrl(path);
  const headers = { "Content-Type": "application/json", ...(init?.headers || {}) };
  const { init: i } = withTimeout({ ...(init || {}), method: "POST", headers, body: JSON.stringify(body) }, timeoutMs);
  const res = await fetch(url, i);
  (i as any).__cancelTimeout?.();
  return handleResponse<T>(res);
}

// ---------- API surface ใช้งานจริงใน UI ----------
export type LicenseJson = {
  id: string;
  owner: string;
  plan: string;
  valid_until: string; // ISO
  checksum: string;
};

/** ตรวจ license ล่าสุดจาก server */
export async function verifyLicenseApi(): Promise<LicenseJson> {
  return get<LicenseJson>("/api/license/latest", undefined, undefined, 10_000);
}

/** อัปโหลดไลเซนส์ใหม่ (รับ JSON ทั้งก้อน) */
export type UploadResult =
  | { ok: true; saved?: string; expiryOk?: boolean; message?: string }
  | { ok: false; error: string; message?: string };

export async function uploadLicense(payload: unknown): Promise<UploadResult> {
  return postJson<UploadResult>("/api/license/upload", payload, undefined, 15_000);
}

/** ตัวอย่าง ping ไปยัง forecast service ที่ถูกครอบด้วย requireLicense() */
export async function pingForecast(): Promise<{ ok: boolean; service: string; ts: number }> {
  return get<{ ok: boolean; service: string; ts: number }>("/api/forecast/ping", undefined, undefined, 5_000);
}
