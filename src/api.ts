/// <reference types="vite/client" />

// ==============================
// Types & Errors
// ==============================
export class LicenseError extends Error {
  code = "license_expired" as const;
  constructor(message = "License expired or invalid. Please upload a new license.") {
    super(message);
    this.name = "LicenseError";
  }
}

export class APIError extends Error {
  status: number;
  payload?: any;
  constructor(message: string, status: number, payload?: any) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.payload = payload;
  }
}

export type LicenseJson = {
  id: string;
  owner: string;
  plan: string;
  valid_until: string;
  checksum: string;
  [k: string]: any;
};

// ==============================
// Base URL
// ==============================
declare global {
  interface Window { ENV?: Record<string, any>; }
}

export function apiBase(): string {
  const vite: any = (import.meta as any)?.env || {};
  const base =
    vite.VITE_API_BASE ||
    vite.VITE_LICENSE_BASE_URL ||
    (typeof window !== "undefined" ? window.ENV?.API_BASE : undefined) ||
    "http://localhost:3001";
  return String(base).replace(/\/+$/, "");
}

export const url = {
  base: apiBase(),
  health: "/health",
  admin: {
    login: "/admin/login",
    logout: "/admin/logout",
    me: "/admin/me",
  },
  license: {
    latest: "/api/license/latest",
    verify: "/api/license/verify",
    generate: "/api/license/generate",
    upload: "/api/license/upload",
  },
  ping: "/api/forecast/ping",
};

// ==============================
/* Fetch helpers */
// ==============================
function withTimeout(init: RequestInit = {}, ms = 0) {
  if (!ms) return { init, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { init: { ...init, signal: controller.signal }, cancel: () => clearTimeout(timer) };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : undefined; } catch { /* ignore */ }

  if (res.status === 403 && (data?.error === "license_expired" || /license/i.test(data?.message ?? ""))) {
    throw new LicenseError(data?.message);
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status} ${res.statusText}`;
    throw new APIError(msg, res.status, data);
  }
  return (data as T) ?? ({} as T);
}

async function GET<T>(p: string, query?: Record<string, any>, timeoutMs = 10_000) {
  const u = new URL(p, apiBase());
  if (query) Object.entries(query).forEach(([k, v]) => v != null && u.searchParams.set(k, String(v)));
  const { init, cancel } = withTimeout({ method: "GET", credentials: "include" }, timeoutMs);
  const res = await fetch(u, init);
  cancel();
  return handleResponse<T>(res);
}

async function POST_JSON<T>(p: string, body: unknown, timeoutMs = 15_000) {
  const u = new URL(p, apiBase());
  const { init, cancel } = withTimeout({
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, timeoutMs);
  const res = await fetch(u, init);
  cancel();
  return handleResponse<T>(res);
}

// ==============================
// Public API (frontend)
// ==============================
export async function health() {
  return GET<{ ok: true; ts: string }>(url.health);
}

export async function adminLogin(username: string, password: string) {
  return POST_JSON<{ ok: boolean; user?: string; error?: string }>(url.admin.login, { username, password });
}

export async function adminLogout() {
  return POST_JSON<{ ok: boolean }>(url.admin.logout, {});
}

export async function adminMe() {
  return GET<{ ok: boolean; user?: string }>(url.admin.me);
}

export async function getLatestLicense(): Promise<LicenseJson> {
  // server ส่งเป็นไฟล์ JSON (sendFile) → fetch แล้ว parse
  const u = new URL(url.license.latest, apiBase());
  const res = await fetch(u.toString(), { credentials: "include", cache: "no-store" });
  if (res.status === 404) throw new APIError("no_license", 404);
  return handleResponse<LicenseJson>(res);
}

export async function verifyLicenseApi() {
  return GET<{ ok: boolean; status: "valid"|"expiring"|"expired"|"invalid_checksum"|"invalid_date"|"missing";
               owner?: string; plan?: string; valid_until?: string; days_left?: number; }>(url.license.verify);
}

export async function generateLicense(args: { owner?: string; days: number; plan?: string }) {
  return POST_JSON<{ ok: boolean; license?: LicenseJson; error?: string }>(url.license.generate, args);
}

export async function uploadLicense(payload: unknown) {
  // server รองรับทั้ง multipart และ application/json — ใช้ JSON ให้เรียบง่าย
  return POST_JSON<{ ok: boolean; file?: string; license?: LicenseJson; error?: string }>(url.license.upload, payload);
}

export async function uploadLicenseFile(file: File) {
  const u = new URL(url.license.upload, apiBase());
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(u.toString(), { method: "POST", credentials: "include", body: form });
  return handleResponse<{ ok: boolean; file?: string; license?: LicenseJson; error?: string }>(res);
}

export async function pingForecast() {
  return GET<{ ok: boolean; pong: boolean; ts: number }>(url.ping);
}
