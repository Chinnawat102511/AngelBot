// -------- Types --------
export type LicenseJson = {
  id: string;
  owner: string;
  plan: string;
  valid_until: string; // ISO
  checksum: string;
};

export type LicenseState =
  | { status: "loading" }
  | { status: "ok"; license: LicenseJson; remainingDays: number }
  | { status: "missing" }
  | { status: "expired"; license?: LicenseJson }
  | { status: "error"; message: string };

// -------- Config / Helpers --------
const RAW_BASE = (import.meta.env.VITE_LICENSE_BASE_URL as string | undefined)?.trim() || "";
const BASE = RAW_BASE.replace(/\/+$/, ""); // ตัด / ท้าย

// ถ้าไม่ได้ตั้ง BASE → ใช้เส้นทางสัมพัทธ์ "/api/..." แล้วให้ Vite proxy จัดการ
function apiUrl(path: string) {
  if (!path.startsWith("/")) path = "/" + path;
  if (BASE) return `${BASE}${path}`;
  return path; // => "/api/...."
}

export function calcRemainingDays(iso: string): number {
  const now = Date.now();
  const end = Date.parse(iso);
  return Math.floor((end - now) / (1000 * 60 * 60 * 24));
}

export function formatDateLocal(dateStr: string, locale = "th-TH") {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

// -------- Core fetchers --------
export async function fetchLatestLicense(): Promise<LicenseState> {
  try {
    const r = await fetch(apiUrl("/api/license/latest"), { credentials: "include" });
    if (r.status === 404) return { status: "missing" };
    if (!r.ok) return { status: "error", message: `HTTP ${r.status}` };

    const lic = (await r.json()) as LicenseJson;
    const remain = calcRemainingDays(lic.valid_until);
    if (remain < 0) return { status: "expired", license: lic };
    return { status: "ok", license: lic, remainingDays: remain };
  } catch (e: any) {
    return { status: "error", message: e?.message ?? "fetch failed" };
  }
}

/** อัปโหลดไฟล์ใบอนุญาต (.json) → เซิร์ฟเวอร์ตอบ { ok, license } หรือ license ตรง ๆ */
export async function uploadLicenseFile(file: File): Promise<LicenseState> {
  const form = new FormData();
  form.append("file", file);

  const r = await fetch(apiUrl("/api/license/upload"), {
    method: "POST",
    body: form,
    credentials: "include",
  });

  if (r.status === 400) {
    const msg = await r.text();
    return { status: "error", message: msg || "invalid license" };
  }
  if (!r.ok) return { status: "error", message: `HTTP ${r.status}` };

  const data = await r.json();
  const lic = (data?.license ?? data) as LicenseJson;

  const remain = calcRemainingDays(lic.valid_until);
  if (remain < 0) return { status: "expired", license: lic };
  return { status: "ok", license: lic, remainingDays: remain };
}

// -------- Simple state helper --------
export type SimpleLicenseState = {
  owner: string;
  plan: string;
  valid_until: string;
  checksum: string;
  valid: boolean;
  nearExpiry: boolean;
  leftDays: number;
};

export async function getLicenseState(): Promise<SimpleLicenseState> {
  const st = await fetchLatestLicense();
  if (st.status !== "ok") {
    return {
      owner: "unknown",
      plan: "free",
      valid_until: "",
      checksum: "-",
      valid: false,
      nearExpiry: false,
      leftDays: 0,
    };
  }
  const { license, remainingDays } = st;
  return {
    owner: license.owner,
    plan: license.plan,
    valid_until: license.valid_until,
    checksum: license.checksum,
    valid: remainingDays > 0,
    nearExpiry: remainingDays <= 7,
    leftDays: remainingDays,
  };
}
