import React from "react";
import { useLicense } from "../context/LicenseContext";
import { formatDateLocal } from "../lib/license";

type Props = { children: React.ReactNode };

export const LicenseGate: React.FC<Props> = ({ children }) => {
  const { state, refresh, upload } = useLicense();

  if (state.status === "loading") {
    return (
      <div style={{ padding: 24 }}>
        <h2>⌛ กำลังตรวจสอบ License...</h2>
        <p className="opacity-70">โปรดรอสักครู่</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div style={{ padding: 24 }}>
        <h2>❌ License error</h2>
        <p style={{ marginTop: 8 }}>{state.message || "Unknown error"}</p>
        <button onClick={refresh} style={{ marginTop: 12 }}>ลองใหม่</button>
      </div>
    );
  }

  if (state.status === "missing" || state.status === "expired") {
    const lic = state.status === "expired" ? state.license : undefined;
    return (
      <div style={{ padding: 24 }}>
        <h2>🔒 ต้องมี License ที่ยังไม่หมดอายุ</h2>
        {lic && (
          <p style={{ marginBottom: 8 }}>
            หมดอายุ: {formatDateLocal(lic.valid_until)}
          </p>
        )}
        <label style={{ display: "inline-block", marginTop: 8 }}>
          <span>อัปโหลดไฟล์ License (.json)</span>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
            style={{ display: "block", marginTop: 6 }}
          />
        </label>
        <div style={{ marginTop: 10 }}>
          <button onClick={refresh}>รีเฟรชสถานะ</button>
        </div>
      </div>
    );
  }

  // status === "ok"
  return <>{children}</>;
};

export default LicenseGate;
