import type { LicenseJson } from "@/types/license";

export type LicenseState =
  | { status: "loading" }
  | { status: "ok"; license: LicenseJson; remainingDays: number }
  | { status: "missing" }
  | { status: "expired"; license?: LicenseJson }
  | { status: "error"; message: string };

export async function fetchLatestLicense(): Promise<LicenseState> {
  try {
    const r = await fetch("/api/license/latest", { method: "GET" });
    if (r.status === 404) return { status: "missing" };
    if (!r.ok) return { status: "error", message: `HTTP ${r.status}` };

    const lic = (await r.json()) as LicenseJson;
    const remainingDays = calcRemainingDays(lic.valid_until);
    if (remainingDays < 0) return { status: "expired", license: lic };
    return { status: "ok", license: lic, remainingDays };
  } catch (e: any) {
    return { status: "error", message: e?.message ?? "fetch failed" };
  }
}

export function calcRemainingDays(iso: string): number {
  const now = Date.now();
  const end = Date.parse(iso);
  return Math.floor((end - now) / (1000 * 60 * 60 * 24));
}

export async function uploadLicenseFile(file: File): Promise<LicenseState> {
  const form = new FormData();
  form.append("file", file);

  const r = await fetch("/api/license/upload", {
    method: "POST",
    body: form,
  });

  if (r.status === 400) {
    const msg = await r.text();
    return { status: "error", message: msg || "invalid license" };
  }
  if (!r.ok) return { status: "error", message: `HTTP ${r.status}` };

  // เซิร์ฟฝั่ง server ควรตอบ license ล่าสุดกลับมา
  const lic = (await r.json()) as LicenseJson;
  const remainingDays = calcRemainingDays(lic.valid_until);
  if (remainingDays < 0) return { status: "expired", license: lic };
  return { status: "ok", license: lic, remainingDays };
}
