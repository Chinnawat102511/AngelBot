// src/components/LicenseBanner.tsx
import * as React from "react";
import { useEffect, useState } from "react";
import { getLicenseState, formatDateLocal } from "../lib/license"; // 👈 เอา resolveBaseUrl ออก

export default function LicenseBanner() {
  const [status, setStatus] = useState<"ok" | "near" | "expired" | "loading">("loading");
  const [validUntil, setValidUntil] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const data = await getLicenseState(); // 👈 ไม่ต้องส่ง resolveBaseUrl()
      setValidUntil(data.valid_until ? formatDateLocal(data.valid_until) : "");
      if (!data.valid) setStatus("expired");
      else if (data.nearExpiry) setStatus("near");
      else setStatus("ok");
    };
    run();
    const t = setInterval(run, 60_000);
    return () => clearInterval(t);
  }, []);

  if (status === "loading") return null;

  const base =
    "mx-2 mt-2 mb-0 rounded-xl border px-3 py-2 text-sm font-medium backdrop-blur transition-all";
  const theme =
    status === "ok"
      ? `${base} border-emerald-200 bg-emerald-100/70 text-emerald-900`
      : status === "near"
      ? `${base} border-amber-200 bg-amber-100/70 text-amber-900`
      : `${base} border-rose-200 bg-rose-100/70 text-rose-900`;

  return (
    <div className={theme}>
      {status === "ok" && <>✅ License OK — หมดอายุ: {validUntil}</>}
      {status === "near" && <>⚠️ ใกล้หมดอายุ — หมดอายุ: {validUntil}</>}
      {status === "expired" && <>⛔ หมดอายุแล้ว — กรุณาอัปโหลด/ต่ออายุ</>}
    </div>
  );
}
