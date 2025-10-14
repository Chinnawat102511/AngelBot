import { useEffect, useState } from "react";
import { getLicenseState, formatDateLocal } from "../lib/license";

type Stat = "ok" | "near" | "expired" | "loading";

/**
 * แสดง 2 บรรทัดตามที่ต้องการ:
 * บรรทัด 1:  License: OK | Near expiry | Expired
 * บรรทัด 2:  Expire: DD/MM/YYYY
 *
 * ใช้ที่ไหนก็ได้: ใน header, toolbar หรือมุมซ้าย
 */
export default function LicenseBanner({
  className = "",
}: { className?: string }) {
  const [status, setStatus] = useState<Stat>("loading");
  const [validUntil, setValidUntil] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const data = await getLicenseState();
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

  const tone =
    status === "ok" ? "ok" : status === "near" ? "near" : "expired";

  return (
    <div
      className={`ab-license-banner ${className}`}
      data-tone={tone}
      title={validUntil ? `Expire: ${validUntil}` : ""}
    >
      <div className="row1">
        {status === "ok" && "License: OK"}
        {status === "near" && "License: Near expiry"}
        {status === "expired" && "License: Expired"}
      </div>
      <div className="row2">{validUntil ? `Expire: ${validUntil}` : ""}</div>
    </div>
  );
}
