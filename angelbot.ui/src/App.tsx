// src/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

// === เพิ่มใหม่สำหรับสถานะสตรีม/แบนเนอร์ ===
import OfflineBanner from "./components/OfflineBanner";
import { useTradesStream } from "./hooks/useEventStream";

// === เสียง ===
import { useSound } from "./components/SoundPack";

// === API (ไม่มี openTradesSSE อีกแล้ว) ===
import {
  startBot,
  stopBot,
  pauseBot,
  resumeBot,
  resetData,
  getTrades,
  getState,
  ping,
  hasData,
  syncAssetsCsv,
} from "./api";

// === type-only ===
import type { AccountType, BotConfig, BotState, GuardMode, RiskGuard, Trade } from "./types";

// === components ===
import SessionStats from "./components/SessionStats";

/* =========================
   helpers / small utils
========================= */
function cx(...ns: (string | false | null | undefined)[]) {
  return ns.filter(Boolean).join(" ");
}
function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}
function btnCls(opts: { disabled?: boolean; color: "green" | "amber" | "indigo" | "rose" | "slate"; active?: boolean }) {
  const { disabled, color, active } = opts;
  const base = "px-3 py-1 rounded text-white transition-[filter,transform] active:brightness-75 active:scale-[0.99]";
  type C = "green" | "amber" | "indigo" | "rose" | "slate";
  const styles: Record<C, { normal: string; active: string }> = {
    green: { normal: "bg-emerald-600", active: "bg-emerald-700 ring-2 ring-emerald-300/60" },
    amber: { normal: "bg-amber-500", active: "bg-amber-600 ring-2 ring-amber-300/60" },
    indigo: { normal: "bg-indigo-600", active: "bg-indigo-700 ring-2 ring-indigo-300/60" },
    rose: { normal: "bg-rose-600", active: "bg-rose-700 ring-2 ring-rose-300/60" },
    slate: { normal: "bg-slate-700", active: "bg-slate-800 ring-2 ring-slate-300/60" },
  };
  return [base, active ? styles[color].active : styles[color].normal, disabled ? "opacity-50 pointer-events-none" : ""].join(" ");
}
function calcRealizedPL(trades: Trade[]) {
  return trades.reduce((s, t) => s + (t.result_pl ?? 0), 0);
}
function downloadCSV(name: string, text: string) {
  const b = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
function makeCSV(trades: Trade[]) {
  const header = ["Timestamp", "Asset", "Direction", "Amount", "MG Step", "Dur", "Result", "Profit", "Strategy"].join(",");
  const rows = trades.map((t) =>
    [t.timestamp, t.asset, t.direction, t.amount, t.mgStep, t.duration, t.result, (t.result_pl ?? 0), t.strategy].join(","),
  );
  return [header, ...rows].join("\n");
}
function csv(name: string, rows: string[][]) {
  downloadCSV(name, rows.map((r) => r.join(",")).join("\n"));
}

/* =========================
   UI local types & storage
========================= */
type RefMode = "Peak" | "Base";
type ProfitGuardMode = GuardMode;
type ProfitAction = "Pause" | "Stop";
interface ProfitGuard {
  enabled: boolean;
  mode: ProfitGuardMode;
  value: number;
  action: ProfitAction;
}
interface Cooldown {
  enabled: boolean;
  minutes: number;
}
interface GuardLogItem {
  time: string;
  reason: "Drawdown" | "ProfitTarget" | "System";
  detail: string;
}

const S_UI = "angelbot.ui.v3";
const S_LIC_KEY = "angelbot.lic.key";
const S_LIC_LOCK = "angelbot.lic.lock_until";
const S_DIRTY_EXIT = "angelbot.session.dirty";

/* =========================
   Component
========================= */
export default function App() {
  const { play, muted, toggle } = useSound();

  /* ===== License state ===== */
  const [licenseKey, setLicenseKey] = useState<string>("");
  const [licenseOk, setLicenseOk] = useState<boolean>(false);
  const [licenseExp, setLicenseExp] = useState<string | null>(null);

  /* ===== Connection ===== */
  const [connection, setConnection] = useState({
    email: "pipatponensri443@gmail.com",
    password: "********",
    accountType: "PRACTICE" as AccountType,
    connected: false,
  });

  /* ===== Bot config ===== */
  const [cfg, setCfg] = useState<BotConfig>({
    orderDuration: "1 Minute",
    amount: 10,
    internalMs: 60000,
    assetsCsv: "XAUUSD,EURUSD",
    strategy: "Baseline",
    baseEquityInput: 1000,
  });

  /* ===== Guards ===== */
  const [guard, setGuard] = useState<RiskGuard>({ enabled: true, mode: "Percent", value: 5 });
  const [refMode, setRefMode] = useState<RefMode>("Peak");
  const [pGuard, setPGuard] = useState<ProfitGuard>({ enabled: true, mode: "Percent", value: 10, action: "Pause" });
  const [cooldown, setCooldown] = useState<Cooldown>({ enabled: true, minutes: 1 });
  const [glog, setGlog] = useState<GuardLogItem[]>([]);

  /* ===== Data / state ===== */
  const [botState, setBotState] = useState<BotState>({
    status: "stopped",
    connected: false,
    accountType: "PRACTICE",
    balance: 0,
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [sseState, setSseState] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  /* ===== Derived ===== */
  const realizedPL = useMemo(() => calcRealizedPL(trades), [trades]);
  const baseEquity = useMemo(() => cfg.baseEquityInput, [cfg.baseEquityInput]);
  const equityLive = useMemo(() => baseEquity + realizedPL, [baseEquity, realizedPL]);
  const basePeakRef = useRef<number>(baseEquity);
  useEffect(() => {
    if (equityLive > basePeakRef.current) basePeakRef.current = equityLive;
  }, [equityLive]);

  /* ===== License helpers ===== */
  function nowIsoPlusDays(d: number) {
    return new Date(Date.now() + d * 86400000).toISOString();
  }
  function isExpired(iso?: string | null) {
    if (!iso) return true;
    const t = Date.parse(iso);
    return !(Number.isFinite(t) && Date.now() < t);
  }
  function forceDisconnect() {
    setConnection((c) => ({ ...c, connected: false }));
    setBotState((s) => ({ ...s, status: "stopped", connected: false }));
    tradesStream.stop();
    clearCooldownTimer();
  }
  async function handleVerify() {
    if (licenseOk && !isExpired(localStorage.getItem(S_LIC_LOCK))) return;
    const key = licenseKey.trim();
    const ok = key.startsWith("ANGEL-");
    if (!ok) {
      setLicenseOk(false);
      setLicenseExp(null);
      localStorage.removeItem(S_LIC_KEY);
      localStorage.removeItem(S_LIC_LOCK);
      forceDisconnect();
      alert("License invalid");
      return;
    }
    const exp = nowIsoPlusDays(14);
    setLicenseOk(true);
    setLicenseExp(exp);
    localStorage.setItem(S_LIC_KEY, key);
    localStorage.setItem(S_LIC_LOCK, exp);
    forceDisconnect(); // ให้กด Connect เองหลัง Verify
  }
  function handleClearLicense() {
    if (licenseOk && !isExpired(localStorage.getItem(S_LIC_LOCK))) return;
    setLicenseKey("");
    setLicenseOk(false);
    setLicenseExp(null);
    localStorage.removeItem(S_LIC_KEY);
    localStorage.removeItem(S_LIC_LOCK);
  }

  /* ===== persistence ===== */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(S_UI);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.connection) setConnection((c) => ({ ...c, email: s.connection.email ?? c.email, accountType: s.connection.accountType ?? c.accountType }));
        if (s.cfg) setCfg((p) => ({ ...p, ...s.cfg }));
        if (s.guard) setGuard((p) => ({ ...p, ...s.guard }));
        if (s.refMode) setRefMode(s.refMode as RefMode);
        if (s.pGuard) setPGuard((p) => ({ ...p, ...s.pGuard }));
        if (s.cooldown) setCooldown((p) => ({ ...p, ...s.cooldown }));
        if (s.glog) setGlog(s.glog as GuardLogItem[]);
      }
      const dirty = localStorage.getItem(S_DIRTY_EXIT) === "1";
      const savedKey = localStorage.getItem(S_LIC_KEY) || "";
      const lock = localStorage.getItem(S_LIC_LOCK);
      if (dirty) {
        localStorage.removeItem(S_DIRTY_EXIT);
        localStorage.removeItem(S_LIC_KEY);
        localStorage.removeItem(S_LIC_LOCK);
        setLicenseKey("");
        setLicenseOk(false);
        setLicenseExp(null);
        alert("Session ก่อนหน้าถูกปิดขณะยังเชื่อมต่ออยู่ — โปรด Verify ใส่ License ใหม่");
      } else if (savedKey && !isExpired(lock || undefined)) {
        setLicenseKey(savedKey);
        setLicenseOk(true);
        setLicenseExp(lock);
      } else {
        setLicenseKey(savedKey || "");
        setLicenseOk(false);
        setLicenseExp(null);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        S_UI,
        JSON.stringify({
          connection: { email: connection.email, accountType: connection.accountType },
          cfg,
          guard,
          refMode,
          pGuard,
          cooldown,
          glog,
        }),
      );
    } catch {}
  }, [connection.email, connection.accountType, cfg, guard, refMode, pGuard, cooldown, glog]);
  // ติดธง dirty-exit
  useEffect(() => {
    const onBeforeUnload = () => {
      if (connection.connected) localStorage.setItem(S_DIRTY_EXIT, "1");
      else localStorage.removeItem(S_DIRTY_EXIT);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [connection.connected]);

  // sync assets ไป server เมื่อผู้ใช้แก้ Assets (CSV) และเชื่อมต่ออยู่
  useEffect(() => {
    if (!connection.connected) return;
    const csv = (cfg.assetsCsv || "").trim();
    const h = setTimeout(() => {
      syncAssetsCsv(csv).catch(() => {});
    }, 300);
    return () => clearTimeout(h);
  }, [cfg.assetsCsv, connection.connected]);

  // หมดอายุ → disconnect
  useEffect(() => {
    const lock = localStorage.getItem(S_LIC_LOCK);
    const expired = isExpired(lock || undefined);
    if (expired) {
      setLicenseOk(false);
      setLicenseExp(null);
      localStorage.removeItem(S_LIC_KEY);
      localStorage.removeItem(S_LIC_LOCK);
      if (connection.connected) forceDisconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseOk]);

  // reference value
  const refValue = refMode === "Peak" ? basePeakRef.current : baseEquity;

  /* ===== Cooldown manager ===== */
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const cooldownEndAt = useRef<number | null>(null);
  const cooldownTick = useRef<ReturnType<typeof setInterval> | null>(null);

  // latest refs
  const cfgRef = useRef(cfg);
  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);
  const connRef = useRef(connection);
  useEffect(() => {
    connRef.current = connection;
  }, [connection]);
  const botStateRef = useRef<BotState>(botState);
  useEffect(() => {
    botStateRef.current = botState;
  }, [botState]);
  const pGuardRef = useRef(pGuard);
  useEffect(() => {
    pGuardRef.current = pGuard;
  }, [pGuard]);
  const refModeRef = useRef(refMode);
  useEffect(() => {
    refModeRef.current = refMode;
  }, [refMode]);
  const equityLiveRef = useRef(equityLive);
  useEffect(() => {
    equityLiveRef.current = equityLive;
  }, [equityLive]);

  // จำพารามิเตอร์ start ล่าสุด
  const lastStartArgsRef = useRef<{ conn: { email: string; password: string; accountType: AccountType }; cfg: BotConfig } | null>(null);
  // กันเด้งซ้ำหลัง resume/start
  const guardSuspendUntil = useRef<number>(0);

  function clearCooldownTimer() {
    if (cooldownTick.current) clearInterval(cooldownTick.current);
    cooldownTick.current = null;
    cooldownEndAt.current = null;
    setCooldownRemaining(0);
  }
  function resetGuardMetersToZero() {
    const nowEq = equityLiveRef.current;
    if (refModeRef.current === "Peak") {
      basePeakRef.current = nowEq;
    } else {
      setCfg((prev) => ({ ...prev, baseEquityInput: nowEq }));
      basePeakRef.current = nowEq;
    }
  }
  // helper: payload สำหรับ startBot (ส่ง orderDuration ด้วยทุกครั้ง)
  function buildStartPayload(c: BotConfig) {
    return {
      assetsCsv: c.assetsCsv,
      intervalMs: c.internalMs,
      amount: c.amount,
      orderDuration: c.orderDuration, // ★ สำคัญ
    };
  }
  function startCooldown(minutes: number) {
    clearCooldownTimer();
    const end = Date.now() + minutes * 60 * 1000;
    cooldownEndAt.current = end;
    cooldownTick.current = setInterval(async () => {
      const remain = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setCooldownRemaining(remain);
      if (remain <= 0) {
        try {
          if (!connRef.current.connected) {
            clearCooldownTimer();
            return;
          }
          resetGuardMetersToZero();
          guardSuspendUntil.current = Date.now() + 5000;
          const stateNow = botStateRef.current;
          const profitAction = pGuardRef.current.action;
          if (stateNow.status === "stopped" || profitAction === "Stop") {
            const args =
              lastStartArgsRef.current ?? {
                conn: {
                  email: connRef.current.email,
                  password: connRef.current.password,
                  accountType: connRef.current.accountType,
                },
                cfg: cfgRef.current,
              };
            await startBot(buildStartPayload(args.cfg)); // ★ ส่ง duration ด้วย
          } else {
            await resumeBot();
          }
          await refetchState();
          setGlog((l) => [{ time: new Date().toISOString(), reason: "System", detail: "Auto-resume after cooldown (meters reset)" }, ...l]);
        } catch {
          setGlog((l) => [{ time: new Date().toISOString(), reason: "System", detail: "Auto-resume failed" }, ...l]);
        } finally {
          clearCooldownTimer();
        }
      }
    }, 1000);
  }

  /* ===== Guard checks ===== */
  useEffect(() => {
    if (botState.status !== "running" || !guard.enabled) return;
    if (Date.now() < guardSuspendUntil.current) return;
    const ddMoney = Math.max(0, refValue - equityLive);
    const ddPct = refValue > 0 ? (ddMoney / refValue) * 100 : 0;
    const hit = guard.mode === "Percent" ? ddPct >= guard.value : ddMoney >= guard.value;
    if (hit) guardTrip("Drawdown", `dd=${ddPct.toFixed(2)}% ($${ddMoney.toFixed(2)}) from ${refMode}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equityLive, guard, botState.status, refMode]);

  useEffect(() => {
    if (botState.status !== "running" || !pGuard.enabled) return;
    if (Date.now() < guardSuspendUntil.current) return;
    const pfMoney = Math.max(0, equityLive - refValue);
    const pfPct = refValue > 0 ? (pfMoney / refValue) * 100 : 0;
    const hit = pGuard.mode === "Percent" ? pfPct >= pGuard.value : pfMoney >= pGuard.value;
    if (hit) guardTrip("ProfitTarget", `profit=${pfPct.toFixed(2)}% ($${pfMoney.toFixed(2)}) from ${refMode}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equityLive, pGuard, botState.status, refMode]);

  async function guardTrip(reason: GuardLogItem["reason"], detail: string) {
    setGlog((l) => [{ time: new Date().toISOString(), reason, detail }, ...l].slice(0, 200));

    // เสียงเตือนตามเหตุ
    if (reason === "Drawdown") play("lose");
    else if (reason === "ProfitTarget") play("win");

    if (pGuard.action === "Stop" && reason === "ProfitTarget") {
      await stopBot().catch(() => {});
    } else {
      await pauseBot().catch(() => {});
    }
    await refetchState();
    if (cooldown.enabled && cooldown.minutes > 0 && connection.connected) {
      startCooldown(cooldown.minutes);
    }
  }

  /* ===== Boot (ping + preload data) ===== */
  useEffect(() => {
    (async () => {
      try {
        await ping();
      } catch {}
      await Promise.all([refetchState(), refetchTrades()]);
    })();
    return () => {
      tradesStream.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== Stream (SSE → Polling fallback) ===== */
  const onSnapshotTrades = (list: Trade[]) => {
    setTrades(list);
    setSseState("connected");
  };
  const onOneTrade = (t: Trade) => {
    setTrades((prev) => {
      const i = prev.findIndex((x) => x.id === t.id);
      if (i >= 0) {
        const n = prev.slice();
        n[i] = t;
        return n;
      }
      return [t, ...prev].slice(0, 500);
    });
    setSseState("connected");
  };
  const tradesStream = useTradesStream(onOneTrade, onSnapshotTrades, { pollInterval: 3000 });

  // map UI state
  useEffect(() => {
    if (tradesStream.mode === "sse") setSseState("connected");
    else if (tradesStream.mode === "connecting") setSseState("connecting");
    else setSseState("disconnected"); // รวม polling/disconnected
  }, [tradesStream.mode]);

  // auto start / stop ตามสถานะ
  useEffect(() => {
    if (botState.status === "stopped" || !connection.connected) {
      tradesStream.stop();
      return;
    }
    tradesStream.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botState.status, connection.connected]);

  /* ===== API wrappers ===== */
  async function refetchState() {
    const r = await getState();
    if (!hasData(r)) return;
    const d = r.data;
    setBotState(d);
    setConnection((c) => ({ ...c, accountType: d.accountType }));
  }
  async function refetchTrades() {
    const r = await getTrades();
    if (!hasData(r)) return;
    setTrades(r.data);
  }

  /* ===== Actions ===== */
  async function onStart() {
    if (!connection.connected || !licenseOk) return;
    // เก็บ config ล่าสุดไว้ใช้ auto-resume
    lastStartArgsRef.current = {
      conn: { email: connection.email, password: connection.password, accountType: connection.accountType },
      cfg,
    };
    await startBot(buildStartPayload(cfg));
    play("start");
    await refetchState();
  }
  async function onPause() {
    if (!connection.connected || !licenseOk) return;
    await pauseBot();
    play("pause");
    await refetchState();
  }
  async function onResume() {
    if (!connection.connected || !licenseOk) return;
    await syncAssetsCsv(cfg.assetsCsv);
    await resumeBot();
    await refetchState();
  }
  async function onStop() {
    if (!connection.connected || !licenseOk) return;
    await stopBot();
    await refetchState();
    tradesStream.stop(); // แทน closeSSE()
    clearCooldownTimer();
  }
  async function onReset() {
    if (!connection.connected || !licenseOk) return;
    if (botState.status !== "stopped") return;
    await resetData();
    await refetchTrades();
  }
  async function onToggleConnect() {
    if (!licenseOk) return;
    if (botState.status !== "stopped" && connection.connected) return;
    if (connection.connected) {
      setConnection((c) => ({ ...c, connected: false }));
      await stopBot().catch(() => {});
      setBotState((s) => ({ ...s, status: "stopped", connected: false }));
      tradesStream.stop(); // แทน closeSSE()
      clearCooldownTimer();
    } else {
      setConnection((c) => ({ ...c, connected: true }));
      // sync assets ทันทีหลัง connect
      syncAssetsCsv((cfg.assetsCsv || "").trim()).catch(() => {});
    }
  }
  function onExportCSV() {
    const csvText = makeCSV(trades);
    const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    downloadCSV(`angelbot_trades_${ts}.csv`, csvText);
  }
  function exportGuardLog() {
    const rows = [["Time", "Reason", "Detail"], ...glog.map((x) => [x.time, x.reason, x.detail])];
    const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    csv(`angelbot_guard_log_${ts}.csv`, rows);
  }

  /* ===== UI States ===== */
  const controlsDisabled = !connection.connected || !licenseOk;
  const isRunning = botState.status === "running";
  const isPaused = botState.status === "paused";
  const isStopped = botState.status === "stopped";
  const editingLocked = !isStopped;

  // meters
  const refValueNow = refMode === "Peak" ? basePeakRef.current : baseEquity;
  const ddMoney = Math.max(0, refValueNow - equityLive);
  const ddPct = refValueNow > 0 ? (ddMoney / refValueNow) * 100 : 0;
  const ddUsed =
    guard.mode === "Percent" ? Math.min(100, (ddPct / (guard.value || 1)) * 100) : Math.min(100, (ddMoney / (guard.value || 1)) * 100);
  const pfMoney = Math.max(0, equityLive - refValueNow);
  const pfPct = refValueNow > 0 ? (pfMoney / refValueNow) * 100 : 0;
  const pfUsed =
    pGuard.mode === "Percent" ? Math.min(100, (pfPct / (pGuard.value || 1)) * 100) : Math.min(100, (pfMoney / (pGuard.value || 1)) * 100);
  const verifyDisabled = licenseOk && !isExpired(localStorage.getItem(S_LIC_LOCK) || undefined);
  const clearDisabled = verifyDisabled;

  /* ===== Asset board ===== */
  const ALL_SYMBOLS: readonly string[] = [
    "XAUUSD",
    "EURUSD",
    "EURJPY",
    "USDJPY",
    "GBPUSD",
    "EURGBP",
    "AUDUSD",
    "XAUUSD-OTC",
    "EURUSD-OTC",
    "AUDCAD-OTC",
    "EURGBP-OTC",
    "GBPUSD-OTC",
  ];
  const [boardTs, setBoardTs] = useState<number>(Date.now());
  const selectedSet = useMemo(() => {
    const s = new Set<string>();
    (cfg.assetsCsv || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => s.add(x));
    return s;
  }, [cfg.assetsCsv]);
  const setSelectedCsv = (next: Set<string>) => setCfg((p) => ({ ...p, assetsCsv: [...next].join(",") }));
  const toggleSymbol = (sym: string, on?: boolean) => {
    const n = new Set(selectedSet);
    const shouldOn = on ?? !n.has(sym);
    if (shouldOn) n.add(sym);
    else n.delete(sym);
    setSelectedCsv(n);
  };
  function seededPrice(sym: string, ts: number) {
    let h = 0;
    for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) | 0;
    h ^= (ts / 1000) | 0;
    const r = (Math.abs(Math.sin(h)) * 10000) % 10000;
    return sym.includes("USD") ? (r / 100).toFixed(5) : r.toFixed(3);
  }
  const boardRows = useMemo(() => {
    type Row = { symbol: string; wins: number; losses: number; net: number; last?: "CALL" | "PUT"; price: string; bias: "Up" | "Down" | "Flat" };
    const map = new Map<string, Row>();
    for (const sym of ALL_SYMBOLS) {
      if (!selectedSet.has(sym)) continue;
      map.set(sym, { symbol: sym, wins: 0, losses: 0, net: 0, last: undefined, price: seededPrice(sym, boardTs), bias: "Flat" });
    }
    const recent = trades.slice(0, 60);
    const dirCount: Record<string, { call: number; put: number }> = {};
    for (const t of recent) {
      if (!map.has(t.asset)) continue;
      const row = map.get(t.asset)!;
      if (t.result === "WIN") row.wins++;
      if (t.result === "LOSE") row.losses++;
      row.net += t.result_pl ?? 0;
      row.last = t.direction;
      (dirCount[t.asset] ||= { call: 0, put: 0 });
      if (t.direction === "CALL") dirCount[t.asset].call++;
      if (t.direction === "PUT") dirCount[t.asset].put++;
    }
    for (const [sym, c] of Object.entries(dirCount)) {
      const r = map.get(sym);
      if (!r) continue;
      const diff = (c.call || 0) - (c.put || 0);
      r.bias = diff > 2 ? "Up" : diff < -2 ? "Down" : "Flat";
    }
    return [...map.values()];
  }, [trades, selectedSet, boardTs]);

  const refreshBoard = () => setBoardTs(Date.now());
  const exportBoardCSV = () => {
    const rows = [
      ["Asset", "UpdatedAt", "Status", "Price", "Trend(MA)", "Wins", "Losses", "Net"],
      ...boardRows.map((r) => [
        r.symbol,
        new Date(boardTs).toLocaleString(),
        selectedSet.has(r.symbol) ? "ON" : "OFF",
        r.price,
        r.bias,
        String(r.wins),
        String(r.losses),
        (r.net >= 0 ? "+" : "") + `$${r.net.toFixed(2)}`,
      ]),
    ];
    const text = rows.map((r) => r.join(",")).join("\n");
    const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    downloadCSV(`asset_board_${ts}.csv`, text);
  };

  /* ===== Render ===== */
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xl font-semibold">🐣 AngelBot • Phase 2 Console</div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-blue-100">{connection.accountType}</span>
            <span className={cx("text-xs px-2 py-1 rounded", connection.connected ? "bg-green-100" : "bg-amber-100")}>
              {connection.connected ? "connected" : "disconnected"}
            </span>
            <span className={cx("text-xs px-2 py-1 rounded", licenseOk ? "bg-green-100" : "bg-rose-100")}>
              {licenseOk ? "license: valid" : "license: invalid"}
            </span>
            {licenseExp && <span className="text-xs opacity-70">exp: {new Date(licenseExp).toLocaleString()}</span>}
            {cooldownRemaining > 0 && (
              <span className="text-xs px-2 py-1 rounded bg-amber-100">
                auto-resume in {Math.floor(cooldownRemaining / 60)}:{String(cooldownRemaining % 60).padStart(2, "0")}
              </span>
            )}

            {/* Controls */}
            <button onClick={onStart} className={btnCls({ disabled: controlsDisabled, color: "green", active: isRunning })} disabled={controlsDisabled}>
              Start
            </button>
            <button onClick={onPause} className={btnCls({ disabled: controlsDisabled, color: "amber", active: isPaused })} disabled={controlsDisabled}>
              Pause
            </button>
            <button
              onClick={onResume}
              className={btnCls({ disabled: controlsDisabled, color: "indigo", active: isRunning && !isPaused })}
              disabled={controlsDisabled}
            >
              Resume
            </button>
            <button onClick={onStop} className={btnCls({ disabled: controlsDisabled, color: "rose", active: isStopped })} disabled={controlsDisabled}>
              Stop
            </button>
            <button
              onClick={onReset}
              className={btnCls({ disabled: !licenseOk || !connection.connected || botState.status !== "stopped", color: "slate" })}
              disabled={!licenseOk || !connection.connected || botState.status !== "stopped"}
            >
              Reset
            </button>

            {/* Sound toggle (กดสลับเสียง) */}
            <button
              onClick={toggle}
              className={btnCls({ disabled: false, color: muted ? "slate" : "green", active: !muted })}
              title={muted ? "Sound is OFF" : "Sound is ON"}
              style={{ minWidth: 88 }}
            >
              {muted ? "🔇 Mute" : "🔊 Sound"}
            </button>
          </div>
        </div>

        {/* Banner: แสดงสถานะสตรีม / ปุ่ม Retry SSE */}
       {/* โชว์เฉพาะตอนหลุดจาก SSE เท่านั้น */}
{tradesStream.mode !== "sse" && (
  <OfflineBanner mode={tradesStream.mode} onRetry={tradesStream.start} />
)}


        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* LEFT */}
          <div className="space-y-4">
            {/* License */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="font-medium mb-2">License</div>
              <div className="space-y-2">
                <input
                  className="w-full input"
                  placeholder="ANGEL-XXXX-XXXX"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  disabled={licenseOk && !isExpired(localStorage.getItem(S_LIC_LOCK) || undefined)}
                />
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded bg-emerald-600 text-white text-xs disabled:opacity-50"
                    onClick={handleVerify}
                    disabled={verifyDisabled}
                  >
                    Verify
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-slate-200 text-xs disabled:opacity-50"
                    onClick={handleClearLicense}
                    disabled={clearDisabled}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Connection */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="font-medium mb-2">Connection</div>
              <div className={cx("space-y-2", !isStopped ? "opacity-60 pointer-events-none select-none" : "")}>
                <label className="text-xs">Email</label>
                <input className="w-full input" value={connection.email} onChange={(e) => setConnection({ ...connection, email: e.target.value })} />
                <label className="text-xs">Password</label>
                <input
                  type="password"
                  className="w-full input"
                  value={connection.password}
                  onChange={(e) => setConnection({ ...connection, password: e.target.value })}
                />
                <label className="text-xs">Account Type</label>
                <select
                  className="w-full input"
                  value={connection.accountType}
                  onChange={(e) => setConnection({ ...connection, accountType: e.target.value as AccountType })}
                >
                  <option value="PRACTICE">PRACTICE</option>
                  <option value="REAL">REAL</option>
                </select>
                <div className="flex items-center justify-between pt-2">
                  <div className={cx("px-2 py-0.5 rounded text-xs", connection.connected ? "bg-green-100" : "bg-slate-100")}>
                    {connection.connected ? "Connected" : "Disconnected"}
                  </div>
                  <button
                    onClick={onToggleConnect}
                    className="px-3 py-1 rounded bg-slate-200 text-xs disabled:opacity-50"
                    disabled={!licenseOk || botState.status !== "stopped"}
                  >
                    {connection.connected ? "Disconnect" : "Connect"}
                  </button>
                </div>
                {!licenseOk && <div className="text-[11px] text-rose-600">* ต้อง Verify License ก่อนจึงจะเชื่อมต่อได้</div>}
              </div>
            </div>

            {/* Bot Control */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="font-medium mb-2">Bot Control</div>
              <div className={cx("grid grid-cols-2 gap-2", !isStopped ? "opacity-60 pointer-events-none select-none" : "")}>
                <div>
                  <label className="text-xs">Order Duration</label>
                  <select
                    className="w-full input"
                    value={cfg.orderDuration}
                    onChange={(e) => setCfg({ ...cfg, orderDuration: e.currentTarget.value as BotConfig["orderDuration"] })}
                  >
                    <option value="1 Minute">1 Minute</option>
                    <option value="3 Minutes">3 Minutes</option>
                    <option value="5 Minutes">5 Minutes</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs">Amount ($)</label>
                  <input className="w-full input" type="number" min={1} value={cfg.amount} onChange={(e) => setCfg({ ...cfg, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs">Interval (ms)</label>
                  <input
                    className="w-full input"
                    type="number"
                    min={1000}
                    step={1000}
                    value={cfg.internalMs}
                    onChange={(e) => setCfg({ ...cfg, internalMs: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs">Assets (CSV)</label>
                  <input className="w-full input" value={cfg.assetsCsv} onChange={(e) => setCfg({ ...cfg, assetsCsv: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs">Strategy</label>
                  <input className="w-full input" value={cfg.strategy} onChange={(e) => setCfg({ ...cfg, strategy: e.target.value as any })} />
                </div>
                <div>
                  <label className="text-xs">Base Equity</label>
                  <input
                    className="w-full input"
                    type="number"
                    value={cfg.baseEquityInput}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCfg({ ...cfg, baseEquityInput: v });
                      basePeakRef.current = v;
                    }}
                  />
                </div>
              </div>

              {/* Equity Trio */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="p-2 rounded bg-slate-50 border">
                  <div className="text-xs opacity-70">Base Equity</div>
                  <div className="text-lg font-semibold">{fmtMoney(baseEquity)}</div>
                </div>
                <div className="p-2 rounded bg-slate-50 border">
                  <div className="text-xs opacity-70">Realized P/L</div>
                  <div className={cx("text-lg font-semibold", realizedPL >= 0 ? "text-green-600" : "text-rose-600")}>
                    {(realizedPL >= 0 ? "+" : "") + fmtMoney(Math.abs(realizedPL))}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-50 border">
                  <div className="text-xs opacity-70">Equity (Live)</div>
                  <div className="text-lg font-semibold">{fmtMoney(equityLive)}</div>
                  <div className="text-[10px] opacity-60">Peak: {fmtMoney(basePeakRef.current)}</div>
                </div>
              </div>
            </div>

            {/* Guard Settings */}
            <div className="rounded-lg bg-white shadow p-4 space-y-3">
              <div className="font-medium mb-1">Guard Settings</div>
              <div className={cx("grid grid-cols-2 gap-2", !isStopped ? "opacity-60 pointer-events-none select-none" : "")}>
                <div>
                  <label className="text-xs">Reference</label>
                  <select className="w-full input" value={refMode} onChange={(e) => setRefMode(e.target.value as RefMode)}>
                    <option>Peak</option>
                    <option>Base</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs">Cooldown Auto-Resume (min)</label>
                  <div className="flex gap-2">
                    <input
                      className="w-full input"
                      type="number"
                      min={1}
                      value={cooldown.minutes}
                      onChange={(e) => setCooldown({ ...cooldown, minutes: Number(e.target.value) })}
                    />
                    <label className="text-xs flex items-center gap-1">
                      <input type="checkbox" checked={cooldown.enabled} onChange={(e) => setCooldown({ ...cooldown, enabled: e.target.checked })} /> Enabled
                    </label>
                  </div>
                </div>
              </div>

              {/* Drawdown Guard */}
              <div className={cx("border rounded p-2", !isStopped ? "opacity-60 pointer-events-none select-none" : "")}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">Risk Guard — Drawdown</div>
                  <label className="text-xs flex items-center gap-1">
                    <input type="checkbox" checked={guard.enabled} onChange={(e) => setGuard({ ...guard, enabled: e.target.checked })} /> Enabled
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-xs">Mode</label>
                    <select className="w-full input" value={guard.mode} onChange={(e) => setGuard({ ...guard, mode: e.target.value as GuardMode })}>
                      <option>Percent</option>
                      <option>Value</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs">Value (%) or ($)</label>
                    <input className="w-full input" type="number" value={guard.value} onChange={(e) => setGuard({ ...guard, value: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="mt-2 text-xs opacity-70">
                  Drawdown: {ddPct.toFixed(2)}% ({fmtMoney(ddMoney)}) / Ref: {refMode === "Peak" ? fmtMoney(basePeakRef.current) : fmtMoney(baseEquity)}
                </div>
                <div className="h-2 bg-slate-200 rounded overflow-hidden mt-1">
                  <div className="h-2 bg-rose-400" style={{ width: `${ddUsed}%` }} />
                </div>
              </div>

              {/* Profit Guard */}
              <div className={cx("border rounded p-2", !isStopped ? "opacity-60 pointer-events-none select-none" : "")}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">Profit Target Guard</div>
                  <label className="text-xs flex items-center gap-1">
                    <input type="checkbox" checked={pGuard.enabled} onChange={(e) => setPGuard({ ...pGuard, enabled: e.target.checked })} /> Enabled
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-xs">Mode</label>
                    <select className="w-full input" value={pGuard.mode} onChange={(e) => setPGuard({ ...pGuard, mode: e.target.value as ProfitGuardMode })}>
                      <option>Percent</option>
                      <option>Value</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs">Value (%) or ($)</label>
                    <input className="w-full input" type="number" value={pGuard.value} onChange={(e) => setPGuard({ ...pGuard, value: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs">Action</label>
                    <select className="w-full input" value={pGuard.action} onChange={(e) => setPGuard({ ...pGuard, action: e.target.value as ProfitAction })}>
                      <option>Pause</option>
                      <option>Stop</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 text-xs opacity-70">
                  Profit: {pfPct.toFixed(2)}% ({fmtMoney(pfMoney)}) from {refMode}
                </div>
                <div className="h-2 bg-slate-200 rounded overflow-hidden mt-1">
                  <div className="h-2 bg-emerald-400" style={{ width: `${pfUsed}%` }} />
                </div>
              </div>
            </div>

            {/* Guard Log */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Guard Log</div>
                <button onClick={exportGuardLog} className="px-2 py-1 rounded bg-slate-800 text-white text-xs">
                  Export
                </button>
              </div>
              <div className="max-h-48 overflow-auto mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left">
                      <th className="p-1">Time</th>
                      <th className="p-1">Reason</th>
                      <th className="p-1">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {glog.length === 0 && (
                      <tr>
                        <td className="p-2 text-slate-500" colSpan={3}>
                          No guard events
                        </td>
                      </tr>
                    )}
                    {glog.map((g, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{new Date(g.time).toLocaleString()}</td>
                        <td className="p-1">{g.reason}</td>
                        <td className="p-1">{g.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="md:col-span-2 space-y-4">
            <SessionStats trades={trades} baseEquity={baseEquity} realizedPL={realizedPL} title="Session Stats" />

            {/* Asset Selection */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Asset Selection</div>
                <div className="text-xs opacity-60">Sync กับ “Assets (CSV)” ใน Bot Control</div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                {ALL_SYMBOLS.map((sym) => (
                  <label key={sym} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedSet.has(sym)} onChange={(e) => toggleSymbol(sym, e.target.checked)} />
                    {sym}
                  </label>
                ))}
              </div>
            </div>

            {/* Asset Live Board */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium flex items-center gap-2">
                  Asset Live Board
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100">{new Date(boardTs).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-60 mr-2">SSE status: {sseState}</span>
                  <button onClick={refreshBoard} className="px-3 py-1 rounded bg-slate-200 text-xs">
                    Refresh
                  </button>
                  <button onClick={exportBoardCSV} className="px-3 py-1 rounded bg-slate-800 text-white text-xs">
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="overflow-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2">Asset</th>
                      <th className="p-2">Updated</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Price</th>
                      <th className="p-2">Trend (MA)</th>
                      <th className="p-2">Wins</th>
                      <th className="p-2">Losses</th>
                      <th className="p-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boardRows.length === 0 && (
                      <tr>
                        <td className="p-3 text-slate-500" colSpan={8}>
                          — no selected assets —
                        </td>
                      </tr>
                    )}
                    {boardRows.map((r) => (
                      <tr key={r.symbol} className="border-t">
                        <td className="p-2 font-medium">{r.symbol}</td>
                        <td className="p-2">{new Date(boardTs).toLocaleString()}</td>
                        <td className="p-2">
                          <label className="inline-flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={selectedSet.has(r.symbol)} onChange={(e) => toggleSymbol(r.symbol, e.target.checked)} />
                            <span className={selectedSet.has(r.symbol) ? "text-emerald-600" : "text-slate-500"}>
                              {selectedSet.has(r.symbol) ? "เปิด" : "ปิด"}
                            </span>
                          </label>
                        </td>
                        <td className="p-2 tabular-nums">{r.price}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              r.bias === "Up" ? "bg-emerald-100" : r.bias === "Down" ? "bg-rose-100" : "bg-slate-100"
                            }`}
                          >
                            {r.bias}
                          </span>
                        </td>
                        <td className="p-2">{r.wins}</td>
                        <td className="p-2">{r.losses}</td>
                        <td className={`p-2 ${r.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.net >= 0 ? "+" : ""}${r.net.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Trade History */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium mb-2">Trade History</div>
                <button onClick={onExportCSV} className="px-3 py-1 rounded bg-slate-800 text-white text-xs">
                  Export CSV
                </button>
              </div>
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left">
                      <th className="p-2">#</th>
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">Asset</th>
                      <th className="p-2">Direction</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">MG</th>
                      <th className="p-2">Dur</th>
                      <th className="p-2">Result</th>
                      <th className="p-2">Profit</th>
                      <th className="p-2">Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, idx) => (
                      <tr key={t.id} className="border-t">
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2">{new Date(t.timestamp).toLocaleString()}</td>
                        <td className="p-2">{t.asset}</td>
                        <td className="p-2">
                          <span className={cx("px-2 py-0.5 rounded text-xs", t.direction === "CALL" ? "bg-emerald-100" : "bg-rose-100")}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="p-2">{fmtMoney(t.amount)}</td>
                        <td className="p-2">{t.mgStep}</td>
                        <td className="p-2">{t.duration}</td>
                        <td className="p-2">
                          <span
                            className={cx(
                              "px-2 py-0.5 rounded text-xs",
                              t.result === "WIN" ? "bg-emerald-100" : t.result === "LOSE" ? "bg-rose-100" : t.result === "EQUAL" ? "bg-slate-100" : "bg-amber-100",
                            )}
                          >
                            {t.result}
                          </span>
                        </td>
                        <td
                          className={cx(
                            "p-2 font-medium",
                            (t.result_pl ?? 0) > 0 ? "text-emerald-600" : (t.result_pl ?? 0) < 0 ? "text-rose-600" : "text-slate-600",
                          )}
                        >
                          {(t.result_pl ?? 0) > 0 ? "+" : ""}
                          {fmtMoney(t.result_pl ?? 0)}
                        </td>
                        <td className="p-2">{t.strategy}</td>
                      </tr>
                    ))}
                    {trades.length === 0 && (
                      <tr>
                        <td className="p-4 text-center text-slate-500" colSpan={10}>
                          No trades yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* small input style */}
      <style>{`.input{padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
      .input:focus{border-color:#94a3b8;box-shadow:0 0 0 3px rgba(148,163,184,.2)}`}</style>
    </div>
  );
}
