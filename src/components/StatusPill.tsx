import React from "react";
import { BASE_URL } from "../lib/license";

type J = Record<string, any>;

function useLatestLicense() {
  const [state, setState] = React.useState<{ ok?: boolean; base?: string; exp?: string } | null>(null);

  const fetchLatest = React.useCallback(async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/license/latest`, { cache: "no-store" });
      const data: J = await r.json().catch(() => ({}));
      setState({ ok: !!data?.ok, base: data?.base, exp: data?.exp });
    } catch {
      setState({ ok: false, base: undefined, exp: undefined });
    }
  }, []);

  React.useEffect(() => {
    fetchLatest();                      // ตอน mount
    const t = setInterval(fetchLatest, 30_000); // ทุก 30 วินาที
    const onUpdated = () => fetchLatest();
    window.addEventListener("license:updated", onUpdated);
    return () => {
      clearInterval(t);
      window.removeEventListener("license:updated", onUpdated);
    };
  }, [fetchLatest]);

  return state;
}

export default function StatusPill() {
  const s = useLatestLicense();
  const badge = s?.ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900";
  const exp = s?.exp ? new Date(s.exp).toLocaleString() : "-";

  return (
    <div className={`fixed left-3 top-56 z-50 rounded px-4 py-3 shadow pointer-events-none ${badge}`}>
      <div className="font-semibold">{s?.ok ? "🟢 License OK" : "🔴 หมดอายุแล้ว — กรุณาอัปโหลด/ต่ออายุ"}</div>
      <div className="text-xs opacity-80 mt-1">
        Base: {s?.base || "-"} &nbsp;•&nbsp; Expire: {exp}
      </div>
    </div>
  );
}
