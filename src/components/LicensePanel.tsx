// C:\AngelBot\src\components\LicensePanel.tsx
import React from "react";
import { BASE_URL } from "../lib/license";

/** ---------- utils ---------- */
type J = Record<string, any>;
const pretty = (x: any) => {
  try {
    return JSON.stringify(typeof x === "string" ? JSON.parse(x) : x, null, 2);
  } catch {
    return typeof x === "string" ? x : String(x);
  }
};
const safeJson = (t: string) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};
const fmtLocal = (s?: string) => (s ? new Date(s).toLocaleString() : "-");
const leftDays = (s?: string) => {
  if (!s) return undefined;
  const ms = +new Date(s) - Date.now();
  return Math.floor(ms / 86400000);
};

/** ---------- component ---------- */
export default function LicensePanel() {
  const [owner, setOwner] = React.useState("AngelTeam");
  const [days, setDays] = React.useState<number>(30);

  const [log, setLog] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  // current status for banner
  const [base, setBase] = React.useState<string>("-");
  const [exp, setExp] = React.useState<string>("-");
  const [ok, setOk] = React.useState<boolean>(false);

  /** อ่านสถานะล่าสุด (latest) */
  const fetchLatest = React.useCallback(async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/license/latest`, { cache: "no-store" });
      const t = await r.text();
      setLog(pretty(t));
      const j = safeJson(t) || {};
      if (j.base) setBase(j.base);
      if (j.exp) setExp(j.exp);
      if (typeof j.ok === "boolean") setOk(Boolean(j.ok));
    } catch (e: any) {
      setLog(`refresh error: ${String(e?.message ?? e)}`);
    }
  }, []);

  /** ตรวจสอบกับ verify (เชื่อถือได้กว่า) */
  const verifyNow = React.useCallback(async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/license/verify`, { cache: "no-store" });
      const t = await r.text();
      setLog(pretty(t));
      const j = safeJson(t) || {};
      setOk(Boolean(j.ok));
      if (j.base) setBase(j.base);
      if (j.exp) setExp(j.exp);
    } catch (e: any) {
      setLog(`verify error: ${String(e?.message ?? e)}`);
    }
  }, []);

  /** on mount: ดึง latest และตามด้วย verify */
  React.useEffect(() => {
    (async () => {
      await fetchLatest();
      await verifyNow();
    })();
  }, [fetchLatest, verifyNow]);

  /** ---- Actions ---- */
  const handleGenerate = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    setLoading(true);
    setLog("Generating…");
    try {
      const r = await fetch(`${BASE_URL}/api/license/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: owner, days, download: false })
      });
      const t = await r.text();
      setLog(pretty(t));

      // อัปเดตสถานะให้สดเสมอ
      await fetchLatest();
      await verifyNow();
    } catch (e: any) {
      setLog(`generate error: ${String(e?.message ?? e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    setLoading(true);
    setLog(`Uploading ${f.name}…`);
    try {
      const form = new FormData();
      form.append("file", f); // server.js ใช้ field = "file"
      const r = await fetch(`${BASE_URL}/api/license/upload`, { method: "POST", body: form });
      const t = await r.text();
      setLog(pretty(t));

      await fetchLatest();
      await verifyNow();
    } catch (e: any) {
      setLog(`upload error: ${String(e?.message ?? e)}`);
    } finally {
      setLoading(false);
      ev.currentTarget.value = ""; // เลือกไฟล์เดิมซ้ำได้
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setLog("Verifying…");
    try {
      await verifyNow();
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async () => {
    setLoading(true);
    setLog("Pinging forecast…");
    try {
      const r = await fetch(`${BASE_URL}/api/forecast/ping`, { cache: "no-store" });
      const t = await r.text();
      setLog(pretty(t));
    } catch (e: any) {
      setLog(`ping error: ${String(e?.message ?? e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetchLatest();
    } finally {
      setLoading(false);
    }
  };

  /** ---------- UI ---------- */
  const badge =
    ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900";
  const dleft = leftDays(exp);

  return (
    <div className="relative z-[1] grid gap-4">
      {/* แบนเนอร์สถานะ (ไม่กินคลิก) */}
      <div className={`pointer-events-none rounded px-4 py-3 ${badge}`}>
        <div className="font-semibold">
          {ok ? "🟢 License OK" : "🔴 หมดอายุแล้ว — กรุณาอัปโหลด/ต่ออายุ"}
        </div>
        <div className="text-sm opacity-80 mt-1">
          Base: {base || "-"} &nbsp;•&nbsp; Expire: {fmtLocal(exp)}
          {typeof dleft === "number" && (
            <span className="ml-2">
              ({dleft >= 0 ? `${dleft} day(s) left` : `${Math.abs(dleft)} day(s) overdue`})
            </span>
          )}
        </div>
      </div>

      {/* โซนควบคุม (รับคลิก) */}
      <div className="pointer-events-auto grid gap-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="border rounded px-3 py-2"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="owner"
          />
          <input
            className="border rounded px-3 py-2"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value || "1", 10) || 1))}
            placeholder="days"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded px-3 py-2 bg-blue-600 text-white disabled:opacity-60"
          >
            {loading ? "Working…" : "Generate"}
          </button>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <input type="file" accept="application/json,.json" onChange={handleUpload} />
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            className="rounded px-3 py-2 bg-emerald-600 text-white disabled:opacity-60"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={handlePing}
            disabled={loading}
            className="rounded px-3 py-2 bg-gray-700 text-white disabled:opacity-60"
          >
            Ping Forecast
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded px-3 py-2 bg-slate-500 text-white disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        <pre className="bg-[#0b1020] text-green-200 text-xs p-3 rounded max-h-64 overflow-auto whitespace-pre-wrap">
{log}
        </pre>
      </div>
    </div>
  );
}
