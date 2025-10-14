import { useEffect, useState } from "react";
import { verifyLicenseApi } from "../api";

/** แปลง ISO → dd/mm/yyyy */
function fmtDDMMYYYY(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

type VerifyView = {
  status?: string;        // 'ok' | 'valid' | 'near' | 'expiring' | 'expired' | ...
  valid_until?: string;   // ISO
};

export default function LicenseBadge({ className = "" }: { className?: string }) {
  const [v, setV] = useState<VerifyView>({});

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const r = await verifyLicenseApi(); // => {status, valid_until, days_left, ...}
        if (!alive) return;
        setV({ status: r?.status as any, valid_until: r?.valid_until });
      } catch {
        if (!alive) return;
        setV({ status: "unknown" });
      }
    };
    pull();
    const t = setInterval(pull, 60_000); // เช็คทุก 1 นาที
    return () => { alive = false; clearInterval(t); };
  }, []);

  const good = v.status === "ok" || v.status === "valid" || v.status === "near" || v.status === "expiring";
  const bg  = good ? "#e8fff3" : "#fff2f2";
  const bd  = good ? "#34d399" : "#f87171";
  const fg1 = good ? "#065f46" : "#7f1d1d";
  const fg2 = good ? "#047857" : "#b91c1c";

  return (
    <div
      className={`license-chip ${className}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        lineHeight: 1.1,
        padding: "6px 10px",
        borderRadius: 8,
        background: bg,
        border: `1px solid ${bd}`,
        minWidth: 150,
      }}
      title={v.status ? `status: ${v.status}` : undefined}
    >
      <span style={{ fontWeight: 700, color: fg1, fontSize: 12 }}>License OK</span>
      <span style={{ color: fg2, fontSize: 12 }}>
        วันหมดอายุ {fmtDDMMYYYY(v.valid_until)}
      </span>
    </div>
  );
}
