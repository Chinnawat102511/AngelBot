// C:\AngelBot\angelbot.ui\src\lib\license.ts
// ตัวกลางคุยกับ API + จัดการ active license path

export const DEFAULT_LICENSE_PATH =
  "C:\\AngelBot\\angelbot.ui\\licenses\\license_output_1d.json";

const LS_KEY = "activeLicensePath";

export function getActivePath(): string {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(LS_KEY) : null;
  return saved && saved.trim().length > 0 ? saved : DEFAULT_LICENSE_PATH;
}

export function setActivePath(p: string) {
  try {
    localStorage.setItem(LS_KEY, p);
  } catch {}
}

function apiUrl(pathname: string, pathParam?: string) {
  const u = new URL(pathname, window.location.origin);
  if (pathParam) u.searchParams.set("path", pathParam);
  return u.toString().replace(window.location.origin, "");
}

// ----------------- API wrappers -----------------
export async function pingForecast() {
  const r = await fetch("/api/ping");
  if (!r.ok) throw new Error(`Ping failed ${r.status}`);
  return r.json();
}

export async function getStatus(path?: string) {
  const p = path ?? getActivePath();
  const r = await fetch(apiUrl("/api/license/status", p));
  if (!r.ok) throw new Error(`Status failed ${r.status}`);
  return r.json();
}

export async function verify(path?: string) {
  const p = path ?? getActivePath();
  const r = await fetch("/api/license/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: p }),
  });
  if (!r.ok) throw new Error(`Verify failed ${r.status}`);
  return r.json();
}

export async function generate(name: string, days: number, path?: string) {
  const p = path ?? getActivePath();
  const r = await fetch("/api/license/gen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: p, name, days }),
  });
  if (!r.ok) throw new Error(`Generate failed ${r.status}`);
  return r.json();
}

// ----------------- Context (banner/status) -----------------
import React from "react";

export type LicenseState = {
  ok: boolean;
  base?: string | null;
  exp?: string | null;
  daysLeft?: number | null;
  path?: string | null;
  reason?: string | null;
};

const Ctx = React.createContext<[LicenseState | null, () => Promise<void>]>([
  null,
  async () => {},
]);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LicenseState | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const s = await getStatus();
      setState({
        ok: !!s?.isValid,
        base: s?.base ?? "-",
        exp: s?.expireAt ?? null,
        daysLeft: typeof s?.daysLeft === "number" ? s.daysLeft : null,
        path: s?.path ?? getActivePath(),
        reason: s?.reason ?? null,
      });
    } catch (e) {
      setState({
        ok: false,
        base: "-",
        exp: null,
        daysLeft: null,
        path: getActivePath(),
        reason: String(e),
      });
    }
  }, []);

  React.useEffect(() => {
    // โหลดครั้งแรก: ให้แน่ใจว่า path พร้อมใช้งาน
    if (!localStorage.getItem(LS_KEY)) {
      setActivePath(DEFAULT_LICENSE_PATH);
    }
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={[state, refresh]}>{children}</Ctx.Provider>;
}

export function useLicenseStatus() {
  return React.useContext(Ctx);
}
