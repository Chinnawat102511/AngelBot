/// <reference types="vite/client" />

/**
 * AngelBot lightweight API client
 * - ปลอดภัยกับ TypeScript บน frontend (ไม่ใช้ process.env)
 * - รวม helper: baseUrl, buildUrl, GET/POST, timeout, download
 * - มี LicenseError สำหรับกรณี 403 license_expired
 */

//////////////////////
// Types & Errors
//////////////////////

export class LicenseError extends Error {
  code = "license_expired" as const;
  constructor(message = "License expired or invalid. Please upload a new license.") {
    super(message);
    this.name = "LicenseError";
  }
}

export function isLicenseError(e: unknown): e is LicenseError {
  return (
    e instanceof LicenseError ||
    (typeof e === "object" && !!e && (e as any).code === "license_expired")
  );
}

export type License = {
  v?: number;
  id: string;
  owner: string;
  plan: string;
  issuedAt?: string;
  expiresAt?: string;
  valid_until?: string; // เผื่อฝั่ง server คืนชื่อนี้
  features?: string[];
  checksum: string;
};

export type LicenseListItem = {
  id: string;
  file: string;
  owner: string;
  plan: string;
  issuedAt: string;
  expiresAt: string;
  valid: boolean;
  mtime: number;
};

//////////////////////
// Base URL helpers
//////////////////////

// อนุญาตให้มี window.ENV ใส่ได้จาก index.html (optional)
declare global {
  interface Window {
    ENV?: Record<string, any>;
  }
}

/** base URL ของเซิร์ฟเวอร์
 * ลำดับ fallback:
 * 1) import.meta.env.VITE_API_BASE
 * 2) import.meta.env.VITE_LICENSE_BASE_URL
 * 3) window.ENV?.API_BASE (ถ้าแปะจาก index.html)
 * 4) http://localhost:3001
 */
export function apiBase(): string {
  const vite = (import.meta as any)?.env ?? {};
  const base =
    vite.VITE_API_BASE ||
    vite.VITE_LICENSE_BASE_URL ||
    (typeof window !== "undefined" ? window.ENV?.API_BASE : undefined) ||
    "http://localhost:3001";
  return String(base).replace(/\/+$/, "");
}

/** สร้าง URL พร้อม query */
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

//////////////////////
// Fetch helpers
//////////////////////

function withTimeout(init?: RequestInit, ms?: number) {
  if (!ms || ms <= 0) return { init: init || {} as RequestInit, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const composed: RequestInit = { ...(init || {}), signal: controller.signal };
  return { init: composed, cancel: () => clearTimeout(timer) };
}

/** แปลง response → ขว้าง error ที่อ่านง่าย (รวม 403 license) */
async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore
  }

  // กรณีโดนบล็อกจาก middleware license
  if (res.status === 403 && (data?.error === "license_expired" || /license/i.test(data?.message ?? ""))) {
    const err = new LicenseError(data?.message);
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

async function httpGet<T>(path: string, query?: Record<string, any>, timeoutMs?: number): Promise<T> {
  const url = buildUrl(path, query);
  const { init, cancel } = withTimeout({ method: "GET" }, timeoutMs);
  const res = await fetch(url, init);
  cancel();
  return handleResponse<T>(res);
}

async function httpPostJson<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
  const url = buildUrl(path);
  const headers = { "Content-Type": "application/json" };
  const { init, cancel } = withTimeout(
    { method: "POST", headers, body: JSON.stringify(body) },
    timeoutMs
  );
  const res = await fetch(url, init);
  cancel();
  return handleResponse<T>(res);
}

//////////////////////
// API surfaces
//////////////////////

/** ตรวจสถานะไลเซนส์ (ฝั่ง server มี route /api/license/verify) */
export async function verifyLicenseApi(): Promise<{
  status: "ok" | "near" | "expired" | "invalid";
  owner?: string;
  plan?: string;
  valid_until?: string;
  days_left?: number;
  message?: string;
}> {
  return httpGet("/api/license/verify", undefined, 10_000);
}

/** สร้าง license ใหม่ (ถ้ามี route นี้ใน server) */
export async function generateLicenseApi(input: { owner: string; days: number; plan?: string }): Promise<{
  status: "ok";
  license: License;
}> {
  return httpPostJson("/api/license/generate", input, 15_000);
}

/** อัปโหลด license JSON (ฝั่ง server: POST /api/license/upload) */
export type UploadResult =
  | { ok: true; saved?: string; expiryOk?: boolean; message?: string }
  | { ok: false; error: string; details?: any };

export async function uploadLicense(payload: unknown): Promise<UploadResult> {
  return httpPostJson("/api/license/upload", payload, 15_000);
}

/** ดึงรายการ license ที่ server มีเก็บไว้ */
export async function listLicensesApi(): Promise<LicenseListItem[]> {
  return httpGet("/api/licenses", undefined, 10_000);
}

/** อ่านรายละเอียด license ตาม id */
export async function viewLicenseApi(id: string): Promise<License> {
  return httpGet(`/api/licenses/${encodeURIComponent(id)}`, undefined, 10_000);
}

/** ดาวน์โหลดไฟล์ license เป็น .json */
export async function downloadLicenseApi(id: string): Promise<void> {
  const url = buildUrl(`/api/licenses/${encodeURIComponent(id)}/download`);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = `${id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

/** ตัวอย่าง ping ไปยัง forecast service (ต้องไม่โดน middleware บล็อก) */
export async function pingForecast(): Promise<{ ok: boolean; service: string; ts: number }> {
  return httpGet("/api/forecast/ping", undefined, 8_000);
}
