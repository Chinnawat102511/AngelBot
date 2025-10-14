// src/pages/AdminPage.tsx
import LicenseBanner from "../components/LicenseBanner";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiBase,
  url,
  getLatestLicense,
  uploadLicenseFile,
  verifyLicenseApi,
  generateLicense,
  pingForecast,
  adminLogin,
  adminLogout,
  adminMe,
  type LicenseJson,
  APIError,
} from "../api";

/* ----------------------- UI helpers (inline) ----------------------- */
// Loading button (มีสปินเนอร์ในปุ่ม)
function LoadingButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
) {
  const { loading, children, className = "", ...rest } = props;

  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={
        "px-3 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center gap-2 " +
        className
      }
    >
      {loading && (
        <>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid currentColor",
              borderRightColor: "transparent",
              display: "inline-block",
              animation: "ab-spin .6s linear infinite",
            }}
          />
          <style>{`@keyframes ab-spin{to{transform:rotate(360deg)}}`}</style>
        </>
      )}
      <span>{children}</span>
    </button>
  );
}

// Toast เบาๆ ในไฟล์เดียว
type Tone = "ok" | "err" | "info";
function Toast({ text, tone }: { text: string; tone: Tone }) {
  const bg = tone === "ok" ? "#e8fff3" : tone === "err" ? "#ffeaea" : "#eef2ff";
  const border =
    tone === "ok" ? "#34d399" : tone === "err" ? "#f87171" : "#93c5fd";
  return (
    <div
      className="shadow rounded px-3 py-2 text-sm"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        minWidth: 220,
        color: "#111827",
      }}
    >
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function AdminPage() {
  // --- UI state ---
  const [error, setError] = useState<string | null>(null);

  // action-level loading (แยกปุ่ม ไม่ล็อกทั้งหน้า)
  const [pingBusy, setPingBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  // --- latest license ---
  const [latest, setLatest] = useState<LicenseJson | null>(null);
  const [raw, setRaw] = useState("");

  // --- ping ---
  const [pingTs, setPingTs] = useState<number | null>(null);

  // --- auth ---
  const [who, setWho] = useState<string | null>(null);
  const [u, setU] = useState<string>(
    (import.meta as any)?.env?.VITE_ADMIN_USER || "admin"
  );
  const [p, setP] = useState<string>(
    (import.meta as any)?.env?.VITE_ADMIN_PASS || ""
  );

  // toast
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (text: string, tone: Tone = "info") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  };

  const apiBaseLabel = useMemo(() => apiBase(), []);

  // ---------- helpers ----------
  async function checkSession() {
    try {
      const me = await adminMe();
      setWho(me?.ok && me.user ? me.user : null);
    } catch {
      setWho(null);
    }
  }

  const ensureAdmin = async (): Promise<boolean> => {
    try {
      const me = await adminMe();
      if (me?.ok && me.user) {
        setWho(me.user);
        return true;
      }
      if (u && p) {
        const r = await adminLogin(u, p);
        if (r.ok) {
          setWho(r.user || "admin");
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const fetchLatest = async () => {
    setRefreshBusy(true);
    setError(null);
    try {
      const data = await getLatestLicense();
      setLatest(data);
      setRaw(JSON.stringify(data, null, 2));
      showToast("รีเฟรชไลเซนส์แล้ว", "ok");
    } catch (e: any) {
      if (e?.status === 404) {
        setLatest(null);
        setRaw("");
      } else {
        setError(e?.message || "fetch failed");
        showToast("ดึงไลเซนส์ไม่สำเร็จ", "err");
      }
    } finally {
      setRefreshBusy(false);
    }
  };

  const doPing = async () => {
    setPingBusy(true);
    setError(null);
    try {
      const r = await pingForecast();
      setPingTs(r.ts ?? Date.now());
      showToast("Ping สำเร็จ", "ok");
    } catch (e: any) {
      setPingTs(null);
      setError(e?.message || "ping failed");
      showToast("Ping ไม่สำเร็จ", "err");
    } finally {
      setPingBusy(false);
    }
  };

  const doVerify = async () => {
    setVerifyBusy(true);
    setError(null);
    try {
      const ok = await ensureAdmin();
      if (!ok) throw new Error("Please login as admin first.");
      const r = await verifyLicenseApi();
      showToast(`Verify: ${r.status}`, "info");
    } catch (e: any) {
      setError(e?.message || "verify failed");
      showToast("Verify ไม่สำเร็จ", "err");
    } finally {
      setVerifyBusy(false);
    }
  };

  const doGenerate = async () => {
    setGenBusy(true);
    setError(null);
    try {
      const ok = await ensureAdmin();
      if (!ok) throw new Error("Please login as admin first.");
      const r = await generateLicense({
        owner: "AngelTeam",
        days: 30,
        plan: "pro",
      });
      if ((r as any).ok) {
        await fetchLatest();
        showToast("Generate license สำเร็จ", "ok");
      } else {
        throw new Error((r as any).error || "generate failed");
      }
    } catch (e: any) {
      setError(e?.message || "generate failed");
      showToast("Generate ไม่สำเร็จ", "err");
    } finally {
      setGenBusy(false);
    }
  };

  const onUploadFile = async (file: File) => {
    setUploadBusy(true);
    setError(null);
    try {
      const ok = await ensureAdmin();
      if (!ok) throw new Error("Please login as admin first.");
      const r = await uploadLicenseFile(file);
      if (!r.ok) throw new Error(r.error || "upload failed");
      await fetchLatest();
      showToast("Upload license สำเร็จ", "ok");
    } catch (e: any) {
      setError(e?.message || "upload failed");
      showToast("Upload ไม่สำเร็จ", "err");
    } finally {
      setUploadBusy(false);
    }
  };

  // --- login / logout actions ---
  const doLogin = async () => {
    setError(null);
    if (!u || p.length === 0) {
      setError("username/password is required");
      showToast("กรอก username/password ให้ครบ", "err");
      return;
    }
    setAuthBusy(true);
    try {
      const r = await adminLogin(u, p);
      if (!r.ok) throw new Error(r.error || "login failed");
      setWho(r.user || "admin");
      showToast("Logged in", "ok");
    } catch (e: any) {
      setWho(null);
      if (e instanceof APIError) {
        if (e.status === 400) setError("Missing username or password.");
        else if (e.status === 401) setError("Invalid username or password.");
        else setError(e.message);
      } else {
        setError(e?.message || "login failed");
      }
      showToast("Login ไม่สำเร็จ", "err");
    } finally {
      setAuthBusy(false);
    }
  };

  const doLogout = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      await adminLogout();
      setWho(null);
      showToast("ออกจากระบบแล้ว", "ok");
    } catch (e: any) {
      setError(e?.message || "logout failed");
      showToast("Logout ไม่สำเร็จ", "err");
    } finally {
      setAuthBusy(false);
    }
  };

  // --- mount / focus effects ---
  useEffect(() => {
    checkSession();
    fetchLatest();
    doPing();
    const onFocus = () => checkSession();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-6">
      {/* License banner */}
      <div className="mt-2 -mb-2">
        <LicenseBanner />
      </div>

      {/* Toast container */}
      <div
        style={{
          position: "fixed",
          right: 14,
          bottom: 14,
          display: "grid",
          gap: 8,
          zIndex: 9999,
        }}
      >
        {toast && <Toast text={toast.text} tone={toast.tone} />}
      </div>

      {/* Server / Endpoints */}
      <section className="border rounded-lg p-4 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold mb-3">Server Health</h2>
          {who && (
            <span
              className="inline-flex items-center text-xs px-2 py-[2px] rounded-full"
              style={{
                background: "#e8fff3",
                border: "1px solid #34d399",
                color: "#065f46",
              }}
              title="Admin session active"
            >
              ● Admin
            </span>
          )}
        </div>

        <div className="text-sm space-y-1">
          <div>
            API base: <code>{apiBaseLabel}</code>
          </div>
          <div>
            License latest: <code>{url.license.latest}</code>
          </div>
          <div>
            Upload license: <code>{url.license.upload}</code>
          </div>
          <div>
            Forecast ping: <code>{url.ping}</code>
          </div>
        </div>

        <div className="mt-3 flex gap-2 flex-wrap">
          <LoadingButton onClick={fetchLatest} loading={refreshBusy}>
            🔄 Refresh license
          </LoadingButton>
          <LoadingButton onClick={doPing} loading={pingBusy}>
            🩺 Ping Forecast
          </LoadingButton>
          {pingTs && (
            <span className="text-xs opacity-70 self-center">
              last ping: {new Date(pingTs).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Admin login box */}
        <div className="mt-4 border-t pt-3 grid gap-2">
          <div className="text-sm font-medium">
            Admin session:&nbsp;
            {who ? (
              <span className="text-green-600">signed in as {who}</span>
            ) : (
              <span className="text-red-600">not signed in</span>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="username"
              value={u}
              onChange={(e) => setU(e.target.value)}
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="password"
              type="password"
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
            {!who ? (
              <LoadingButton onClick={doLogin} loading={authBusy}>
                🔐 Login
              </LoadingButton>
            ) : (
              <LoadingButton onClick={doLogout} loading={authBusy}>
                🚪 Logout
              </LoadingButton>
            )}
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-red-600">✖ {error}</div>}
      </section>

      {/* Verify */}
      <section className="border rounded-lg p-4 bg-white dark:bg-gray-900">
        <h2 className="font-semibold mb-2">Verify License</h2>
        <p className="text-sm opacity-80 mb-2">
          ตรวจสอบความถูกต้องของใบอนุญาตล่าสุดกับเซิร์ฟเวอร์
        </p>
        <LoadingButton onClick={doVerify} loading={verifyBusy}>
          ✅ Verify now
        </LoadingButton>
      </section>

      {/* Generate (dev) */}
      <section className="border rounded-lg p-4 bg-white dark:bg-gray-900">
        <h2 className="font-semibold mb-2">Generate License (dev)</h2>
        <p className="text-sm opacity-80 mb-2">
          ทดสอบสร้างไลเซนส์ใหม่ (เฉพาะสภาพแวดล้อมที่เปิด endpoint นี้)
        </p>
        <LoadingButton onClick={doGenerate} loading={genBusy} disabled={!who}>
          🧰 Generate new license
        </LoadingButton>
      </section>

      {/* Latest license */}
      <section className="border rounded-lg p-4 bg-white dark:bg-gray-900">
        <h2 className="font-semibold mb-3">Latest License</h2>
        {latest ? (
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <div>
              <b>ID:</b> {latest.id}
            </div>
            <div>
              <b>Owner:</b> {latest.owner}
            </div>
            <div>
              <b>Plan:</b> {latest.plan}
            </div>
            <div>
              <b>Valid until:</b> {latest.valid_until}
            </div>
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

      {/* Upload */}
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
            disabled={uploadBusy}
          />
          <span className="text-xs opacity-70">
            เลือกไฟล์ JSON แล้วระบบจะอัปโหลดให้ทันที
          </span>
        </div>
      </section>
    </div>
  );
}
