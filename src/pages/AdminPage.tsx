// src/pages/AdminPage.tsx
import { useEffect, useMemo, useState } from "react";

type LicenseJson = {
  id: string;
  owner: string;
  plan: string;
  valid_until: string;
  checksum: string;
};

const API_BASE = (import.meta.env.VITE_LICENSE_BASE_URL || "/api").replace(/\/$/, "");

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState<LicenseJson | null>(null);
  const [raw, setRaw] = useState("");
  const [pingTs, setPingTs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const licenseUrl = useMemo(() => `${API_BASE}/license/latest`, []);
  const uploadUrl  = useMemo(() => `${API_BASE}/license/upload`, []);
  const pingUrl    = useMemo(() => `${API_BASE}/forecast/ping`, []);

  const fetchLatest = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${licenseUrl}?t=${Date.now()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRaw(JSON.stringify(data, null, 2));
      // รองรับเคสที่ server อาจส่งฟิลด์เพิ่มหรือลด
      const j: LicenseJson = {
        id: data.id ?? "",
        owner: data.owner ?? "",
        plan: data.plan ?? "",
        valid_until: data.valid_until ?? "",
        checksum: data.checksum ?? "",
      };
      setLatest(j);
    } catch (e: any) {
      setError(e.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const pingForecast = async () => {
    setError(null);
    try {
      const r = await fetch(`${pingUrl}?t=${Date.now()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setPingTs(j.ts ?? Date.now());
    } catch (e: any) {
      setError(e.message || "ping failed");
      setPingTs(null);
    }
  };

  const onUploadFile = async (file: File) => {
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(uploadUrl, { method: "POST", body: form });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fetchLatest();
      alert("✅ Upload license สำเร็จ");
    } catch (e: any) {
      setError(e.message || "upload failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
    pingForecast();
  }, []);

  return (
    <div className="grid gap-6">
      {/* Server/Endpoints overview */}
      <section className="border rounded-lg p-4 bg-white dark:bg-gray-900">
        <h2 className="font-semibold mb-3">Server Health</h2>
        <div className="text-sm space-y-1">
          <div>API base: <code>{API_BASE}</code></div>
          <div>License latest: <code>{licenseUrl}</code></div>
          <div>Upload license: <code>{uploadUrl}</code></div>
          <div>Forecast ping: <code>{pingUrl}</code></div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={fetchLatest}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            disabled={loading}
          >
            🔄 Refresh license
          </button>
          <button
            onClick={pingForecast}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            🩺 Ping Forecast
          </button>
          {pingTs && (
            <span className="text-xs opacity-70 self-center">
              last ping: {new Date(pingTs).toLocaleTimeString()}
            </span>
          )}
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600">✖ {error}</div>
        )}
      </section>

      {/* Latest license brief */}
      <section className="border rounded-lg p-4 bg-white dark:bg-gray-900">
        <h2 className="font-semibold mb-3">Latest License</h2>
        {latest ? (
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <div><b>ID:</b> {latest.id}</div>
            <div><b>Owner:</b> {latest.owner}</div>
            <div><b>Plan:</b> {latest.plan}</div>
            <div><b>Valid until:</b> {latest.valid_until}</div>
            <div className="sm:col-span-2 break-all">
              <b>Checksum:</b> {latest.checksum}
            </div>
          </div>
        ) : (
          <div className="text-sm opacity-70">No data</div>
        )}

        <textarea
          className="mt-3 w-full h-40 text-xs font-mono border rounded p-2 bg-gray-50 dark:bg-gray-800"
          value={raw}
          readOnly
        />
      </section>

      {/* Upload new license (json file) */}
      <section className="border rounded-lg p-4 bg-white dark:bg-gray-900">
        <h2 className="font-semibold mb-3">Upload New License</h2>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadFile(f);
            }}
          />
          <span className="text-xs opacity-70">
            เลือกไฟล์ JSON แล้วระบบจะอัปโหลดให้ทันที
          </span>
        </div>
      </section>
    </div>
  );
}
