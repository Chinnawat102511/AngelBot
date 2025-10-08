// src/api/index.ts
export type GeneratePayloadByDays = {
  owner: string;
  plan: string;
  days: number;      // ต้องมีเมื่อโหมด days
};
export type GeneratePayloadByExpires = {
  owner: string;
  plan: string;
  expires: string;   // YYYY-MM-DD ต้องมีเมื่อโหมด expires
};
export type GeneratePayload = GeneratePayloadByDays | GeneratePayloadByExpires;

const BASE = (import.meta as any).env?.VITE_LICENSE_BASE_URL || "";

function makeUrl(p: string) {
  return BASE ? `${BASE}${p}` : p; // ถ้า BASE ว่าง ใช้ proxy ของ Vite (/api -> :3001)
}

async function http<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, init);
  if (!r.ok) throw new Error((await r.text().catch(() => "")) || `HTTP ${r.status}`);
  return (await r.json()) as T;
}

export async function generateLicenseApi(payload: GeneratePayload) {
  return http(makeUrl("/api/license/generate"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}
