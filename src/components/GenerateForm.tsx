import { useMemo, useState } from "react";
import { generateLicenseApi } from "../api";

/** ชนิดข้อมูลฝั่งฟอร์ม (รองรับ 2 โหมด: days | expires) */
type Mode = "days" | "expires";
type GeneratePayloadDays = { owner: string; plan: string; days: number };
type GeneratePayloadExpires = { owner: string; plan: string; expires: string };
type GeneratePayload = GeneratePayloadDays | GeneratePayloadExpires;

export default function GenerateForm() {
  const [owner, setOwner] = useState("AngelTeam");
  const [plan, setPlan] = useState("pro");
  const [mode, setMode] = useState<Mode>("days");

  const [days, setDays] = useState<number>(30);
  const [expires, setExpires] = useState<string>(""); // YYYY-MM-DD

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!owner.trim()) return false;
    if (mode === "days") return Number.isFinite(days) && days > 0;
    if (mode === "expires") return Boolean(expires);
    return false;
  }, [owner, mode, days, expires]);

  const onGenerate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: GeneratePayload =
        mode === "days"
          ? { owner: owner.trim(), plan, days: Number(days) }
          : { owner: owner.trim(), plan, expires };

      // กัน type mismatch ถ้าโปรเจกต์เก่ายังไม่ได้อัปเดต type ของ API
      const data = await generateLicenseApi(payload as any);

      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Generate failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      style={{
        background: "var(--card-bg, #f4f4f4)",
        padding: "16px",
        borderRadius: "10px",
      }}
    >
      <h2 style={{ marginBottom: 12 }}>⚙️ Generate License</h2>

      {/* โหมด */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 12 }}>
          <input
            type="radio"
            name="mode"
            value="days"
            checked={mode === "days"}
            onChange={() => setMode("days")}
          />{" "}
          ต่ออายุเป็นจำนวนวัน
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="expires"
            checked={mode === "expires"}
            onChange={() => setMode("expires")}
          />{" "}
          ระบุวันหมดอายุ
        </label>
      </div>

      {/* ฟอร์ม */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto auto",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <label style={{ opacity: 0.8 }}>Owner</label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          style={{
            gridColumn: "span 4",
            padding: "12px 10px",
            borderRadius: 10,
            border: "1px solid #ccc",
            minWidth: 220,
          }}
        />

        <label style={{ opacity: 0.8 }}>Plan</label>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          style={{
            padding: "12px 10px",
            borderRadius: 10,
            border: "1px solid #ccc",
            minWidth: 120,
          }}
        >
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="premium">premium</option>
        </select>

        {mode === "days" ? (
          <>
            <label style={{ opacity: 0.8 }}>Days</label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{
                width: 120,
                padding: "12px 10px",
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
            />
          </>
        ) : (
          <>
            <label style={{ opacity: 0.8 }}>Expires</label>
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              style={{
                width: 180,
                padding: "12px 10px",
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
            />
          </>
        )}

        <button
          onClick={onGenerate}
          disabled={loading || !canSubmit}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: loading || !canSubmit ? "#9aa0a6" : "#0078D7",
            color: "#fff",
            fontWeight: 600,
            cursor: loading || !canSubmit ? "not-allowed" : "pointer",
          }}
          title={!canSubmit ? "กรอกข้อมูลให้ครบก่อน" : "สร้างไลเซนส์"}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}>❌ {error}</p>}

      {result && (
        <pre
          style={{
            background: "#0b0f14",
            color: "#e6edf3",
            padding: 12,
            borderRadius: 8,
            overflow: "auto",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      <small style={{ display: "block", marginTop: 8, color: "#555" }}>
        © AngelTeam
      </small>
    </section>
  );
}
