// src/lib/api.ts
// Lightweight API client for AngelBot UI (with admin-cookie support)

/* ── Errors ───────────────────────────────────────────── */
export class LicenseError extends Error {
  code = "license_expired";
  constructor(message = "License expired or invalid. Please upload a new license.") {
    super(message);
    this.name = "LicenseError";
  }
}
export class APIError<T = unknown> extends Error {
  status: number;
  payload?: T;
  constructor(status: number, message: string, payload?: T) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.payload = payload;
  }
}
export function isLicenseError(e: unknown): e is LicenseError {
  return e instanceof LicenseError || (typeof e === "object" && !!e && (e as any).code === "license_expired");
}

/* ── Base URL & URL builder ───────────────────────────── */
export function apiBase(): string {
  const v = (import.meta as any)?.env?.VITE_LICENSE_BASE_URL;
  const base = (v && String(v)) || "http://localhost:3001";
  return base.replace(/\/+$/, "");
}
export function buildUrl(path: string, query?: Record<string, any>): string {
  const base = apiBase();
  const u = new URL(path.startsWith("/") ? path : `/${path}`, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

/* ── Fetch helpers ────────────────────────────────────── */
type TimeoutInit = RequestInit & { __cancelTimeout?: () => void };

const withCreds = (init?: RequestInit): TimeoutInit =>
  ({
    credentials: "include",
    cache: "no-store",
    ...(init || {}),
  } as TimeoutInit);

function withTimeout(init?: RequestInit, ms?: number): { init: TimeoutInit } {
  const i = withCreds(init);
  if (!ms || ms <= 0) return { init: i };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  i.signal = controller.signal;
  (i as TimeoutInit).__cancelTimeout = () => clearTimeout(timer);
  return { init: i };
}

function defaultHeaders(h?: HeadersInit): HeadersInit {
  return {
    Accept: "application/json",
    "X-Requested-With": "AngelBotUI",
    ...(h || {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = undefined;

  const ctype = res.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
  } else {
    try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
  }

  const msg = (data?.message ?? data?.error ?? "").toString().toLowerCase();

  if (res.status === 403 || (res.status === 401 && msg.includes("license"))) {
    const err = new LicenseError(data?.message || "License error");
    (err as any).code = "license_expired";
    throw err;
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `API error ${res.status}: ${res.statusText}`;
    throw new APIError(res.status, message, data);
  }

  return (data as T) ?? ({} as T);
}

export async function get<T>(
  path: string,
  query?: Record<string, any>,
  init?: RequestInit,
  timeoutMs?: number
): Promise<T> {
  const url = buildUrl(path, query);
  const { init: i } = withTimeout({ ...(init || {}), method: "GET", headers: defaultHeaders(init?.headers) }, timeoutMs);
  const res = await fetch(url, i);
  (i as any).__cancelTimeout?.();
  return handleResponse<T>(res);
}

export async function postJson<T>(
  path: string,
  body?: unknown,
  init?: RequestInit,
  timeoutMs?: number
): Promise<T> {
  const url = buildUrl(path);
  const headers = { "Content-Type": "application/json", ...defaultHeaders(init?.headers) };
  const { init: i } = withTimeout({ ...(init || {}), method: "POST", headers, body: body != null ? JSON.stringify(body) : undefined }, timeoutMs);
  const res = await fetch(url, i);
  (i as any).__cancelTimeout?.();
  return handleResponse<T>(res);
}

export async function postForm<T>(
  path: string,
  form: FormData,
  init?: RequestInit,
  timeoutMs?: number
): Promise<T> {
  const url = buildUrl(path);
  const headers = defaultHeaders(init?.headers); // ให้ browser ใส่ boundary
  const { init: i } = withTimeout({ ...(init || {}), method: "POST", headers, body: form }, timeoutMs);
  const res = await fetch(url, i);
  (i as any).__cancelTimeout?.();
  return handleResponse<T>(res);
}

/* ── Types ─────────────────────────────────────────────── */
export type LicenseJson = {
  id: string;
  owner: string;
  plan: string;
  valid_until: string;
  checksum: string;
};
export type UploadResult =
  | { ok: true; saved?: string; expiryOk?: boolean; message?: string; license?: LicenseJson }
  | { ok: false; error: string; message?: string };

/* ── High-level API ────────────────────────────────────── */
export async function getLatestLicense(): Promise<LicenseJson> {
  return get<LicenseJson>("/api/license/latest", undefined, undefined, 10_000);
}
export async function uploadLicenseFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return postForm<UploadResult>("/api/license/upload", form, undefined, 15_000);
}
export async function uploadLicenseJson(payload: unknown): Promise<UploadResult> {
  return postJson<UploadResult>("/api/license/upload", payload, undefined, 15_000);
}
export async function verifyLicenseApi(): Promise<{ ok: boolean; status: string; [k: string]: any }> {
  return get("/api/license/verify", undefined, undefined, 10_000);
}
export async function generateLicense(params?: { owner?: string; plan?: string; days?: number }) {
  return postJson<{ ok: true; file: string; license: LicenseJson } | { ok: false; error: string }>(
    "/api/license/generate",
    params || {},
    undefined,
    15_000
  );
}
export async function pingForecast(): Promise<{ ok: boolean; service?: string; ts: number }> {
  return get("/api/forecast/ping", undefined, undefined, 5_000);
}
export async function getServerStatus(): Promise<any> {
  try {
    return await get("/api/status", { t: Date.now() }, undefined, 5_000);
  } catch {
    return get("/status", { t: Date.now() }, undefined, 5_000);
  }
}

/* ── Admin auth (cookie-based) ─────────────────────────── */
export async function adminLogin(username: string, password: string) {
  return postJson<{ ok: boolean; user?: string; role?: string; error?: string }>(
    "/admin/login",
    { username, password },
    undefined,
    10_000
  );
}
export async function adminLogout() {
  try {
    return await postJson<{ ok: boolean }>("/admin/logout", {});
  } catch {
    return get<{ ok: boolean }>("/admin/logout");
  }
}
export async function adminMe() {
  return get<{ ok: boolean; user?: string; role?: string }>("/admin/me", undefined, undefined, 10_000);
}

/* ── Back-compat (for header display / hard links) ─────── */
export const API = apiBase();
export const url = {
  status: buildUrl("/api/status"),
  ping: buildUrl("/api/forecast/ping"),
  licenseLatest: buildUrl("/api/license/latest"),
  licenseUpload: buildUrl("/api/license/upload"),
  licenseVerify: buildUrl("/api/license/verify"),
  licenseGenerate: buildUrl("/api/license/generate"),
};

/* ── Quick JSON fetch (minimal handling) ────────────────── */
export async function j<T>(input: RequestInfo, init: RequestInit = {}): Promise<T> {
  const r = await fetch(input, {
    credentials: "include",
    cache: "no-store",
    headers: { "X-Requested-With": "AngelBotUI", ...(init.headers || {}) },
    ...init,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

// ---------- Session helpers ----------
export async function sessionResetLife() {
  return postJson<{ ok: boolean; session: any }>("/api/session/reset-life");
}
export async function sessionResetSession() {
  return postJson<{ ok: boolean; session: any }>("/api/session/reset-session");
}
export async function sessionAddNote(note: string) {
  return postJson<{ ok: boolean; session: any }>("/api/session/note", { note });
}
