import { useState } from "react";
import { verifyLicenseApi } from "../api";
import { uploadLicense, isLicenseError } from "../lib/api"; // ⬅️ เปลี่ยนเป็น relative

export default function VerifyCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [licenseText, setLicenseText] = useState(""); // ✅ สำหรับช่องกรอก license ใหม่

  // ตรวจสอบ license
  const onVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await verifyLicenseApi();
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Verify failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ อัปโหลด license JSON ใหม่
  const onUpload = async () => {
    try {
      const json = JSON.parse(licenseText);
      const res = await uploadLicense(json);
      if (!res.ok) throw new Error(res.error);
      alert("✅ License uploaded successfully!");
      setLicenseText("");
    } catch (e: any) {
      if (isLicenseError(e)) {
        alert("⛔ License expired — please request a new one from admin.");
      } else {
        alert("❌ Upload failed: " + (e.message || e));
      }
    }
  };

  return (
    <section
      style={{
        background: "#fff",
        padding: "16px",
        borderRadius: "10px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
        marginBottom: "24px",
      }}
    >
      <h2 style={{ marginBottom: "10px" }}>🔒 Verify License</h2>

      <button
        onClick={onVerify}
        disabled={loading}
        style={{
          background: loading ? "#ccc" : "#0078d4",
          color: "#fff",
          border: "none",
          padding: "8px 14px",
          borderRadius: "6px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Verifying..." : "Verify now"}
      </button>

      {error && (
        <p style={{ color: "crimson", marginTop: "12px" }}>❌ {error}</p>
      )}

      {result && (
        <pre
          style={{
            background: "#f9f9f9",
            color: "#222",
            padding: "12px",
            borderRadius: "8px",
            overflowX: "auto",
            marginTop: "16px",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      {/* ✅ ส่วน Upload License */}
      <div
        style={{
          marginTop: "20px",
          borderTop: "1px solid #eee",
          paddingTop: "16px",
        }}
      >
        <h3 style={{ fontSize: "16px", marginBottom: "6px" }}>
          🧾 Upload New License
        </h3>
        <textarea
          value={licenseText}
          onChange={(e) => setLicenseText(e.target.value)}
          placeholder='Paste license JSON here'
          rows={5}
          style={{
            width: "100%",
            padding: "8px",
            fontSize: "13px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            resize: "vertical",
          }}
        />
        <button
          onClick={onUpload}
          style={{
            marginTop: "8px",
            background: "#4caf50",
            color: "#fff",
            padding: "8px 14px",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Upload License
        </button>
      </div>
    </section>
  );
}
