// src/components/ForecastPanel.tsx
import * as React from "react";
import { pingForecast, apiBase, isLicenseError } from "../lib/api";

export default function ForecastPanel() {
  const [loading, setLoading] = React.useState(false);
  const [last, setLast] = React.useState<null | { ts: number; service: string }>(null);
  const [error, setError] = React.useState<string | null>(null);

  const base = apiBase();

  const doPing = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pingForecast(); // { ok, service, ts }
      setLast({ ts: res.ts, service: res.service });
    } catch (e: any) {
      if (isLicenseError(e)) {
        setError("🔒 License required — กรุณาอัปโหลดไลเซนส์ใหม่");
      } else {
        setError(e?.message || "Ping failed");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ping ครั้งแรกเมื่อโหลด
  React.useEffect(() => {
    void doPing();
  }, [doPing]);

  return (
    <section
      style={{
        background: "#fff",
        padding: "16px",
        borderRadius: 10,
        boxShadow: "0 2px 6px rgba(0,0,0,.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>📡 Forecast Panel</h2>
        <div style={{ fontSize: 12, opacity: 0.7 }}>API: <code>{base}</code></div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={doPing}
          disabled={loading}
          style={{
            background: loading ? "#ccc" : "#2563eb",
            color: "#fff",
            border: "none",
            padding: "8px 14px",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Checking..." : "Test Forecast API"}
        </button>

        {last && (
          <span style={{ fontSize: 14, color: "#065f46" }}>
            ✅ OK — <b>{last.service}</b> ({new Date(last.ts).toLocaleTimeString()})
          </span>
        )}
      </div>

      {error && (
        <p style={{ color: "crimson", marginTop: 10, marginBottom: 0 }}>❌ {error}</p>
      )}
    </section>
  );
}
