// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { getServerStatus, postJson } from "@lib/api";
import { adminMe, generateLicense, getLatestLicense } from "../api";
import LicenseBanner from "../components/LicenseBanner";

/* ----------------------- UI helpers (inline) ----------------------- */
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

type Tone = "ok" | "err" | "info";
function Toast({ text, tone }: { text: string; tone: Tone }) {
  const bg = tone === "ok" ? "#e8fff3" : tone === "err" ? "#ffeaea" : "#eef2ff";
  const border = tone === "ok" ? "#34d399" : tone === "err" ? "#f87171" : "#93c5fd";
  return (
    <div
      className="shadow rounded px-3 py-2 text-sm"
      style={{ background: bg, border: `1px solid ${border}`, minWidth: 220, color: "#111827" }}
    >
      {text}
    </div>
  );
}

/* --------------------------- Types --------------------------- */
type NoteRow = string | { ts?: string | number; type?: string; note?: string; msg?: string };
type SessionStatus = {
  running: boolean;
  connected: boolean;
  startedAt?: string | null;
  lastActionAt?: string | null;
  w: number;
  l: number;
  d: number;
  pnl: number;
  maxMG: number;
  step: number;
  payout: number;
  maxStake?: number;
  notes?: NoteRow[];
};
type StatusResp = { ok: boolean; connected: boolean; running: boolean; session: SessionStatus };

/* ----------------------- LocalStorage ----------------------- */
const LS_KEYS = { lifeOffset: "ab.lifeOffset", sessionOffset: "ab.sessionOffset" };
const readNumber = (k: string, fb = 0) => {
  const v = localStorage.getItem(k);
  if (v == null) return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const writeNumber = (k: string, n: number) => localStorage.setItem(k, String(n));

/* ------------------------- UI utils ------------------------- */
const fmtNum = (n: number, digits = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "-";
const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");
const toLocalTs = (ts?: string | number | null) => {
  if (!ts) return "-";
  try {
    const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
  } catch {
    return "-";
  }
};

/* ============================ Home ============================ */
export default function Home() {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // toast
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (text: string, tone: Tone = "info") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  };

  // offsets
  const [lifeOffset, setLifeOffset] = useState(() => readNumber(LS_KEYS.lifeOffset, 0));
  const [sessionOffset, setSessionOffset] = useState(() => readNumber(LS_KEYS.sessionOffset, 0));

  // note input
  const [noteText, setNoteText] = useState("");

  // detect running false->true => auto reset session (offset)
  const prevRunning = useRef<boolean | null>(null);

  // admin / generate
  const [isAdmin, setIsAdmin] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const pull = async () => {
    try {
      const s = await getServerStatus();
      setStatus(s);
      setError(null);
      setLoading(false);

      const running = !!s?.session?.running;
      if (prevRunning.current === false && running === true) {
        const base = Number(s?.session?.pnl) || 0;
        const newOffset = -base;
        setSessionOffset(newOffset);
        writeNumber(LS_KEYS.sessionOffset, newOffset);
        showToast("เริ่มเซสชันใหม่ — รีเซ็ต Session PnL (offset)", "ok");
      }
      prevRunning.current = running;
    } catch (e: any) {
      setError(e?.message || "fetch failed");
      setLoading(false);
      showToast("รีเฟรชไม่สำเร็จ", "err");
    }
  };

  // ปุ่มรีเฟรชแบบมี Toast
  const doRefresh = async () => {
    try {
      await pull();
      showToast("รีเฟรชสถานะแล้ว", "ok");
    } catch {
      showToast("รีเฟรชไม่สำเร็จ", "err");
    }
  };

  // polling + check admin on focus
  useEffect(() => {
    let alive = true;

    const loop = async () => {
      await pull();
      if (!alive) return;
    };
    loop();
    const poll = setInterval(loop, 2000);

    const checkAdmin = async () => {
      try {
        const me = await adminMe();
        setIsAdmin(!!me?.ok && !!me.user);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
    const onFocus = () => checkAdmin();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // values
  const s = status?.session;
  const w = s?.w ?? 0;
  const l = s?.l ?? 0;
  const d = s?.d ?? 0;
  const serverPnl = s?.pnl ?? 0;

  const lifePnl = useMemo(() => serverPnl + lifeOffset, [serverPnl, lifeOffset]);
  const sessionPnl = useMemo(() => serverPnl + sessionOffset, [serverPnl, sessionOffset]);
  const lastAction = s?.lastActionAt ?? null;

  // ---- Actions ----
  const resetLifeLocal = () => {
    const newOffset = -(serverPnl || 0);
    setLifeOffset(newOffset);
    writeNumber(LS_KEYS.lifeOffset, newOffset);
    showToast("รีเซ็ต Life PnL (offset) แล้ว", "ok");
  };

  const resetSessionLocal = () => {
    const newOffset = -(serverPnl || 0);
    setSessionOffset(newOffset);
    writeNumber(LS_KEYS.sessionOffset, newOffset);
    showToast("รีเซ็ต Session PnL (offset) แล้ว", "ok");
  };

  const resetLifeServer = async () => {
    try {
      await postJson("/api/session/reset-life", {});
      showToast("รีเซ็ต Life PnL (server) สำเร็จ", "ok");
      await pull();
    } catch {
      resetLifeLocal();
    }
  };

  const resetSessionServer = async () => {
    try {
      await postJson("/api/session/reset-session", {});
      showToast("รีเซ็ต Session PnL (server) สำเร็จ", "ok");
      await pull();
    } catch {
      resetSessionLocal();
    }
  };

  const addNote = async () => {
    const msg = noteText.trim();
    if (!msg) return;
    try {
      await postJson("/api/session/note", { msg });
      setNoteText("");
      showToast("บันทึกโน้ตแล้ว", "ok");
      await pull();
    } catch (e: any) {
      setError(e?.message || "add note failed");
      showToast("บันทึกโน้ตไม่สำเร็จ", "err");
    }
  };

  const onGenerate = async () => {
    if (!isAdmin) return showToast("ต้องเป็น Admin ก่อนนะ", "err");
    setGenLoading(true);
    try {
      const r = await generateLicense({ owner: "AngelTeam", days: 30, plan: "pro" });
      if (!(r as any)?.ok) throw new Error((r as any)?.error || "generate failed");
      try {
        await getLatestLicense();
      } catch {}
      showToast("Generate license สำเร็จ", "ok");
    } catch (e: any) {
      setError(e?.message || "generate failed");
      showToast("Generate ไม่สำเร็จ", "err");
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="container animate-in">
      {/* Toast container (top-right; ไม่บังตาราง) */}
      <div
        style={{
          position: "fixed",
          right: 14,
          top: 14,
          display: "grid",
          gap: 8,
          zIndex: 9999,
        }}
      >
        {toast && <Toast text={toast.text} tone={toast.tone} />}
      </div>

      {/* Action bar */}
      <div className="ab-toolbar" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button className="ab-btn ab-btn-blue" onClick={doRefresh}>🔄 Refresh</button>

        <div className="ab-btn-group">
          <button className="ab-btn ab-btn-ghost" onClick={resetLifeServer}>🧹 Reset Life PnL</button>
          <button className="ab-btn ab-btn-ghost" onClick={resetSessionServer}>🧹 Reset Session PnL</button>
        </div>

        <div className="ab-input-group">
          <input
            className="ab-input"
            placeholder="Add note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
          />
          <button className="ab-btn ab-btn-green" onClick={addNote}>➕ Add</button>
        </div>

        {/* ดันขวา */}
        <div style={{ flex: 1 }} />

        {/* License banner ชิดขวา */}
        <LicenseBanner />

        {/* ปุ่มสำหรับแอดมิน */}
        {isAdmin && (
          <LoadingButton
            className="ab-btn ab-btn-ghost"
            onClick={onGenerate}
            loading={genLoading}
            title="Generate new license (admin only)"
          >
            🧰 Generate
          </LoadingButton>
        )}
      </div>

      {/* แถว KPI หลัก */}
      <div className="ab-grid">
        {/* 📊 Win / Lose / Draw + PnL */}
        <section className="ab-panel">
          <div className="ab-head">📊 ผลการเทรด (Wins / Losses / Draws)</div>

          <div className="ab-row mb-2">
            <div className="ab-col-4">
              <label className="ab-l">Wins</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">W</div>
                <div className="ab-kpi-num text-success">{fmtNum(w, 0)}</div>
              </div>
            </div>
            <div className="ab-col-4">
              <label className="ab-l">Losses</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">L</div>
                <div className="ab-kpi-num text-danger">{fmtNum(l, 0)}</div>
              </div>
            </div>
            <div className="ab-col-4">
              <label className="ab-l">Draws</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">D</div>
                <div className="ab-kpi-num">{fmtNum(d, 0)}</div>
              </div>
            </div>
          </div>

          <div className="ab-row">
            <div className="ab-col-6">
              <label className="ab-l">Life PnL</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">สะสม (offset)</div>
                <div className={cls("ab-kpi-num", lifePnl >= 0 ? "text-success" : "text-danger")}>
                  {fmtNum(lifePnl)}
                </div>
              </div>
              <div className="mt-2">
                <button className="ab-btn ab-btn-ghost" onClick={resetLifeServer}>รีเซ็ต Life PnL</button>
              </div>
            </div>
            <div className="ab-col-6">
              <label className="ab-l">Session PnL</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">เริ่มนับเมื่อบอทเริ่มวิ่ง</div>
                <div className={cls("ab-kpi-num", sessionPnl >= 0 ? "text-success" : "text-danger")}>
                  {fmtNum(sessionPnl)}
                </div>
              </div>
              <div className="mt-2">
                <button className="ab-btn ab-btn-ghost" onClick={resetSessionServer}>รีเซ็ต Session PnL</button>
                <span className="badge-note" style={{ marginLeft: 8 }}>
                  จะรีเซ็ตอัตโนมัติเมื่อเริ่มสตาร์ทบอท
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 💰 พารามิเตอร์เทรด / Martingale */}
        <section className="ab-panel">
          <div className="ab-head">💰 พารามิเตอร์เทรด / Martingale</div>
          <div className="ab-row">
            <div className="ab-col-4">
              <label className="ab-l">P&L (Server)</label>
              <div className={cls("ab-kpi-card", (serverPnl ?? 0) >= 0 ? "text-success" : "text-danger")}>
                <div className="ab-kpi-title">pnl</div>
                <div className="ab-kpi-num">{fmtNum(serverPnl)}</div>
              </div>
            </div>

            <div className="ab-col-4">
              <label className="ab-l">Max MG used</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">maxMG</div>
                <div className="ab-kpi-num">{fmtNum(s?.maxMG ?? 0, 0)}</div>
              </div>
            </div>

            <div className="ab-col-4">
              <label className="ab-l">Current Step</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">step</div>
                <div className="ab-kpi-num">{fmtNum(s?.step ?? 0, 0)}</div>
              </div>
            </div>

            <div className="ab-col-4">
              <label className="ab-l">Payout (%)</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">payout</div>
                <div className="ab-kpi-num">{fmtNum(s?.payout ?? 0, 0)}</div>
              </div>
            </div>

            <div className="ab-col-4">
              <label className="ab-l">Stake / Max Stake</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">maxStake</div>
                <div className="ab-kpi-num">{fmtNum(s?.maxStake ?? 0, 0)}</div>
              </div>
            </div>

            <div className="ab-col-4">
              <label className="ab-l">Martingale Plan</label>
              <div className="ab-kpi-card">
                <div className="ab-kpi-title">layers</div>
                <div className="ab-kpi-num">10 ชั้น</div>
              </div>
            </div>
          </div>
        </section>

        {/* ⏱ สถานะระบบ (การ์ดสูงเท่ากัน) */}
        <section className="ab-panel">
          <div className="ab-head">⏱ สถานะระบบ</div>
          <div className="ab-row">
            <div className="ab-col-6">
              <label className="ab-l">Last Action</label>
              <div className="ab-kpi-card ab-kpi-card--status">
                <div className="ab-kpi-title">timestamp</div>
                <div className="ab-kpi-num">{toLocalTs(lastAction)}</div>
              </div>
            </div>
            <div className="ab-col-3">
              <label className="ab-l">Connected</label>
              <div className="ab-kpi-card ab-kpi-card--status">
                <div className="ab-kpi-title">engine</div>
                <div className="ab-kpi-num">
                  <span className={cls("status-dot", s?.connected ? "status-connected" : "status-disconnected")} />
                  {s?.connected ? "Connected" : "Offline"}
                </div>
              </div>
            </div>
            <div className="ab-col-3">
              <label className="ab-l">Running</label>
              <div className="ab-kpi-card ab-kpi-card--status">
                <div className="ab-kpi-title">bot</div>
                <div className="ab-kpi-num">
                  <span className={cls("status-dot", s?.running ? "status-connected" : "status-disconnected")} />
                  {s?.running ? "Running" : "Stopped"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 🧠 Notes */}
        <section className="ab-panel">
          <div className="ab-head">🧠 Notes (session)</div>
          {s?.notes?.length ? (
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>#</th>
                  <th style={{ width: 180 }}>Time</th>
                  <th style={{ width: 120 }}>Type</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {s.notes.map((row, i) => {
                  const isObj = typeof row === "object" && row !== null;
                  const ts   = isObj ? (row as any).ts : null;
                  const type = isObj ? ((row as any).type || "-") : "-";
                  const msg  = isObj ? ((row as any).note ?? (row as any).msg ?? "") : (row as string);
                  return (
                    <tr key={i}>
                      <td className="text-end">{i + 1}</td>
                      <td>{toLocalTs(ts)}</td>
                      <td>{type}</td>
                      <td>{msg || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="badge-note">— ไม่มีบันทึก —</div>
          )}
        </section>
      </div>

      {loading && <div className="mt-3 badge-note">กำลังโหลดสถานะ…</div>}
      {error && <div className="alert alert-err mt-3">✖ {error}</div>}
    </div>
  );
}
