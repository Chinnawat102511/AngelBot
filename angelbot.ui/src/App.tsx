import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  startBot, stopBot, pauseBot, resumeBot, resetData,
  getTrades, getState, openTradesSSE, ping, hasData,
} from "./api";
import type {
  AccountType, BotConfig, BotState, GuardMode, RiskGuard, Trade
} from "./types";

// ⬇️ เพิ่มบรรทัดนี้
import SessionStats from "./components/SessionStats";

// ---------- utils ----------
function cx(...ns: (string | false | null | undefined)[]) { return ns.filter(Boolean).join(" "); }
function fmtMoney(n: number) { return `$${n.toFixed(2)}`; }
function btnCls(opts: { disabled?: boolean; color: "green"|"amber"|"indigo"|"rose"|"slate"; active?: boolean }) {
  const { disabled, color, active } = opts;
  const base="px-3 py-1 rounded text-white transition-[filter,transform] active:brightness-75 active:scale-[0.99]";
  type C="green"|"amber"|"indigo"|"rose"|"slate";
  const styles: Record<C,{normal:string;active:string}>={
    green:{normal:"bg-emerald-600",active:"bg-emerald-700 ring-2 ring-emerald-300/60"},
    amber:{normal:"bg-amber-500",active:"bg-amber-600 ring-2 ring-amber-300/60"},
    indigo:{normal:"bg-indigo-600",active:"bg-indigo-700 ring-2 ring-indigo-300/60"},
    rose:{normal:"bg-rose-600",active:"bg-rose-700 ring-2 ring-rose-300/60"},
    slate:{normal:"bg-slate-700",active:"bg-slate-800 ring-2 ring-slate-300/60"},
  };
  return [base, active?styles[color].active:styles[color].normal, disabled?"opacity-50 pointer-events-none":""].join(" ");
}
function calcRealizedPL(trades: Trade[]) { return trades.reduce((s,t)=>s+(t.result_pl??0),0); }
function downloadCSV(name: string, text: string) {
  const b = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const u = URL.createObjectURL(b); const a = document.createElement("a");
  a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u);
}
function makeCSV(trades: Trade[]) {
  const header = ["Timestamp","Asset","Direction","Amount","MG Step","Dur","Result","Profit","Strategy"].join(",");
  const rows = trades.map(t=>[t.timestamp,t.asset,t.direction,t.amount,t.mgStep,t.duration,t.result,(t.result_pl??0),t.strategy].join(","));
  return [header, ...rows].join("\n");
}
function csv(name:string, rows:string[][]){ downloadCSV(name, rows.map(r=>r.join(",")).join("\n")); }
function beep(freq=880, sec=0.2){ try{
  const c=new (window.AudioContext||(window as any).webkitAudioContext)();
  const o=c.createOscillator(); const g=c.createGain();
  o.type="sine"; o.frequency.value=freq; o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0.0001,c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.35,c.currentTime+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+sec);
  o.start(); o.stop(c.currentTime+sec+0.01); setTimeout(()=>c.close(), (sec+0.2)*1000);
} catch {}}

// ---------- new UI types ----------
type RefMode = "Peak" | "Base";
type ProfitGuardMode = GuardMode; // Percent | Value
type ProfitAction = "Pause" | "Stop";
interface ProfitGuard { enabled: boolean; mode: ProfitGuardMode; value: number; action: ProfitAction; }
interface Cooldown { enabled: boolean; minutes: number; }
interface GuardLogItem { time: string; reason: "Drawdown" | "ProfitTarget" | "System"; detail: string; }

// ---------- component ----------
export default function App() {
  // connection
  const [connection, setConnection] = useState({
    email: "pipatponensri443@gmail.com",
    password: "********",
    accountType: "PRACTICE" as AccountType,
    connected: false,
  });

  // bot config (UI only)
  const [cfg, setCfg] = useState<BotConfig>({
    orderDuration: "1 Minute",
    amount: 10,
    internalMs: 60000,
    assetsCsv: "XAUUSD,EURUSD",
    strategy: "Baseline",
    baseEquityInput: 1000,
  });

  // guards
  const [guard, setGuard] = useState<RiskGuard>({ enabled: true, mode: "Percent", value: 5 });
  const [refMode, setRefMode] = useState<RefMode>("Peak");
  const [pGuard, setPGuard] = useState<ProfitGuard>({ enabled: true, mode: "Percent", value: 10, action: "Pause" });
  const [cooldown, setCooldown] = useState<Cooldown>({ enabled: true, minutes: 1 });
  const [glog, setGlog] = useState<GuardLogItem[]>([]);

  // data / sse
  const [botState, setBotState] = useState<BotState | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [sseState, setSseState] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const stopSSERef = useRef<null | (() => void)>(null);

  // derived
  const realizedPL = useMemo(()=>calcRealizedPL(trades),[trades]);
  const baseEquity = useMemo(()=>cfg.baseEquityInput,[cfg.baseEquityInput]);
  const equityLive = useMemo(()=>baseEquity + realizedPL,[baseEquity, realizedPL]);

  const basePeakRef = useRef<number>(baseEquity);
  useEffect(()=>{ if (equityLive > basePeakRef.current) basePeakRef.current = equityLive; }, [equityLive]);

  // ========= persistence =========
  useEffect(()=>{ try{
    const raw=localStorage.getItem("angelbot.ui.v3");
    if(raw){
      const s=JSON.parse(raw);
      if(s.connection) setConnection(c=>({...c, email:s.connection.email??c.email, accountType:s.connection.accountType??c.accountType }));
      if(s.cfg) setCfg((p)=>({...p,...s.cfg}));
      if(s.guard) setGuard((p)=>({...p,...s.guard}));
      if(s.refMode) setRefMode(s.refMode as RefMode);
      if(s.pGuard) setPGuard((p)=>({...p,...s.pGuard}));
      if(s.cooldown) setCooldown((p)=>({...p,...s.cooldown}));
      if(s.glog) setGlog(s.glog as GuardLogItem[]);
    }
  }catch{} },[]);
  useEffect(()=>{ try{
    localStorage.setItem("angelbot.ui.v3", JSON.stringify({
      connection:{ email:connection.email, accountType:connection.accountType },
      cfg, guard, refMode, pGuard, cooldown, glog
    }));
  }catch{} },[connection.email, connection.accountType, cfg, guard, refMode, pGuard, cooldown, glog]);

  // reference value
  const refValue = refMode === "Peak" ? basePeakRef.current : baseEquity;

  // ========= Cooldown manager =========
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0); // seconds
  const cooldownEndAt = useRef<number | null>(null);
  const cooldownTick = useRef<ReturnType<typeof setInterval> | null>(null);

  // latest refs to avoid stale closures
  const cfgRef  = useRef(cfg);        useEffect(()=>{ cfgRef.current = cfg; }, [cfg]);
  const connRef = useRef(connection); useEffect(()=>{ connRef.current = connection; }, [connection]);
  const botStateRef = useRef<BotState | null>(botState); useEffect(()=>{ botStateRef.current = botState; }, [botState]);
  const pGuardRef = useRef(pGuard);   useEffect(()=>{ pGuardRef.current = pGuard; }, [pGuard]);
  const refModeRef = useRef(refMode); useEffect(()=>{ refModeRef.current = refMode; }, [refMode]);
  const equityLiveRef = useRef(equityLive); useEffect(()=>{ equityLiveRef.current = equityLive; }, [equityLive]);

  // จำพารามิเตอร์ start ล่าสุด
  const lastStartArgsRef = useRef<{ conn: { email: string; password: string; accountType: AccountType }; cfg: BotConfig } | null>(null);

  // กันเด้งซ้ำหลัง resume/start
  const guardSuspendUntil = useRef<number>(0);

  function clearCooldownTimer() {
    if (cooldownTick.current) clearInterval(cooldownTick.current);
    cooldownTick.current = null; cooldownEndAt.current = null;
    setCooldownRemaining(0);
  }

  // รีเซ็ตมิเตอร์ Guard ⇒ กลับ 0% ก่อนสตาร์ท/รีซูม
  function resetGuardMetersToZero() {
    const nowEq = equityLiveRef.current;
    if (refModeRef.current === "Peak") {
      basePeakRef.current = nowEq; // เปลี่ยน Peak = ปัจจุบัน ⇒ dd/profit = 0
    } else {
      // Base mode → ย้ายฐานทุนเป็นค่าปัจจุบัน
      setCfg((prev) => ({ ...prev, baseEquityInput: nowEq }));
      basePeakRef.current = nowEq;
    }
  }

  function startCooldown(minutes: number) {
    clearCooldownTimer();
    const end = Date.now() + minutes*60*1000;
    cooldownEndAt.current = end;
    cooldownTick.current = setInterval(async () => {
      const remain = Math.max(0, Math.ceil((end - Date.now())/1000));
      setCooldownRemaining(remain);
      if (remain <= 0) {
        try {
          if (!connRef.current.connected) { clearCooldownTimer(); return; }

          // รีเซ็ต Guard → 0 ก่อนออโต้เริ่ม
          resetGuardMetersToZero();

          // กัน trigger ซ้ำทันที 5 วินาที
          guardSuspendUntil.current = Date.now() + 5000;

          const stateNow = botStateRef.current;
          const profitAction = pGuardRef.current.action;

          if (stateNow?.status === "stopped" || profitAction === "Stop") {
            const args = lastStartArgsRef.current ?? {
              conn: { email: connRef.current.email, password: connRef.current.password, accountType: connRef.current.accountType },
              cfg: cfgRef.current,
            };
            await startBot(args.conn, args.cfg);
          } else {
            await resumeBot();
          }
          await refetchState();
          setGlog(l=>[{ time:new Date().toISOString(), reason:"System", detail:"Auto-resume after cooldown (meters reset)" }, ...l]);
        } catch {
          setGlog(l=>[{ time:new Date().toISOString(), reason:"System", detail:"Auto-resume failed" }, ...l]);
        } finally {
          clearCooldownTimer();
        }
      }
    }, 1000);
  }

  // ========= Guard checks =========
  // Drawdown
  useEffect(() => {
    if (!botState || botState.status !== "running" || !guard.enabled) return;
    if (Date.now() < guardSuspendUntil.current) return; // suspend window
    const ddMoney = Math.max(0, refValue - equityLive);
    const ddPct   = refValue > 0 ? (ddMoney / refValue) * 100 : 0;
    const hit = guard.mode === "Percent" ? ddPct >= guard.value : ddMoney >= guard.value;
    if (hit) guardTrip("Drawdown", `dd=${ddPct.toFixed(2)}% ($${ddMoney.toFixed(2)}) from ${refMode}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equityLive, guard, botState?.status, refMode]);

  // Profit Target
  useEffect(() => {
    if (!botState || botState.status !== "running" || !pGuard.enabled) return;
    if (Date.now() < guardSuspendUntil.current) return; // suspend window
    const pfMoney = Math.max(0, equityLive - refValue);
    const pfPct   = refValue > 0 ? (pfMoney / refValue) * 100 : 0;
    const hit = pGuard.mode === "Percent" ? pfPct >= pGuard.value : pfMoney >= pGuard.value;
    if (hit) guardTrip("ProfitTarget", `profit=${pfPct.toFixed(2)}% ($${pfMoney.toFixed(2)}) from ${refMode}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equityLive, pGuard, botState?.status, refMode]);

  async function guardTrip(reason: GuardLogItem["reason"], detail: string) {
    setGlog(l=>[{ time:new Date().toISOString(), reason, detail }, ...l].slice(0,200));
    beep(reason==="Drawdown"?880:520, 0.25);

    if (pGuard.action === "Stop" && reason === "ProfitTarget") {
      await stopBot().catch(()=>{});
    } else {
      await pauseBot().catch(()=>{});
    }
    await refetchState();

    if (cooldown.enabled && cooldown.minutes > 0 && connection.connected) {
      startCooldown(cooldown.minutes);
    }
  }

  // ========= boot / sse =========
  useEffect(()=>{ (async()=>{
    try{ await ping(); }catch{}
    await Promise.all([refetchState(), refetchTrades()]);
  })(); return ()=>{ if (stopSSERef.current) stopSSERef.current(); }; }, []);
  useEffect(()=>{ // manage SSE
    if (!botState || botState.status === "stopped" || !connection.connected) { closeSSE(); return; }
    openSSE();
  }, [botState?.status, connection.connected]);

  async function refetchState(){ const r=await getState(); if(!hasData(r)) return; const d=r.data;
    setBotState(d); setConnection(c=>({...c, accountType:d.accountType}));
  }
  async function refetchTrades(){ const r=await getTrades(); if(!hasData(r)) return; setTrades(r.data); }

  function openSSE(){ if (stopSSERef.current) return; setSseState("connecting");
    stopSSERef.current = openTradesSSE(
      (t)=>{ setTrades(p=>{const i=p.findIndex(x=>x.id===t.id); if(i>=0){const n=p.slice(); n[i]=t; return n;} return [t,...p].slice(0,500);}); setSseState("connected"); },
      (list)=>{ setTrades(list.slice().reverse()); setSseState("connected"); }
    );
  }
  function closeSSE(){ if (stopSSERef.current){ stopSSERef.current(); stopSSERef.current=null; } setSseState("disconnected"); }

  // ========= actions =========
  async function onStart() {
    if (!connection.connected) return;
    const conn = { email: connection.email, password: connection.password, accountType: connection.accountType };
    lastStartArgsRef.current = { conn, cfg };  // เก็บไว้ใช้ auto-start
    const r = await startBot(conn, cfg);
    if (hasData(r)) await refetchState();
  }
  async function onPause(){ if(!connection.connected) return; await pauseBot(); await refetchState(); }
  async function onResume(){ if(!connection.connected) return; await resumeBot(); await refetchState(); }
  async function onStop(){ if(!connection.connected) return; await stopBot(); await refetchState(); closeSSE(); clearCooldownTimer(); }
  async function onReset(){ if(!connection.connected) return; await resetData(); await refetchTrades(); basePeakRef.current = baseEquity; }

  async function onToggleConnect(){
    if (connection.connected){
      setConnection(c=>({...c, connected:false}));
      await stopBot().catch(()=>{});
      setBotState(s=>s?{...s,status:"stopped",connected:false}:s);
      closeSSE();
      clearCooldownTimer();
    } else {
      setConnection(c=>({...c, connected:true}));
    }
  }

  function onExportCSV(){
    const csvText = makeCSV(trades);
    const ts = new Date().toISOString().slice(0,19).replace(/[-:T]/g,"");
    downloadCSV(`angelbot_trades_${ts}.csv`, csvText);
  }
  function exportGuardLog(){
    const rows=[["Time","Reason","Detail"], ...glog.map(x=>[x.time,x.reason,x.detail])];
    const ts=new Date().toISOString().slice(0,19).replace(/[-:T]/g,"");
    csv(`angelbot_guard_log_${ts}.csv`, rows);
  }

  // UI states
  const controlsDisabled = !connection.connected;
  const isRunning = botState?.status==="running";
  const isPaused  = botState?.status==="paused";
  const isStopped = botState?.status==="stopped";

  // meters
  const refValueNow = refMode === "Peak" ? basePeakRef.current : baseEquity;
  const ddMoney = Math.max(0, refValueNow - equityLive);
  const ddPct   = refValueNow > 0 ? (ddMoney/refValueNow)*100 : 0;
  const ddUsed  = guard.mode==="Percent" ? Math.min(100, (ddPct/(guard.value||1))*100) : Math.min(100, (ddMoney/(guard.value||1))*100);

  const pfMoney = Math.max(0, equityLive - refValueNow);
  const pfPct   = refValueNow > 0 ? (pfMoney/refValueNow)*100 : 0;
  const pfUsed  = pGuard.mode==="Percent" ? Math.min(100, (pfPct/(pGuard.value||1))*100) : Math.min(100, (pfMoney/(pGuard.value||1))*100);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xl font-semibold">🐣 AngelBot • Phase 2 Console</div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-blue-100">{connection.accountType}</span>
            <span className={cx("text-xs px-2 py-1 rounded", connection.connected ? "bg-green-100":"bg-amber-100")}>
              {connection.connected ? "connected" : "disconnected"}
            </span>

            {/* cooldown countdown */}
            {cooldownRemaining > 0 && (
              <span className="text-xs px-2 py-1 rounded bg-amber-100">
                auto-resume in {Math.floor(cooldownRemaining/60)}:{String(cooldownRemaining%60).padStart(2,"0")}
              </span>
            )}

            {/* Controls */}
            <button onClick={onStart}  className={btnCls({disabled:controlsDisabled,color:"green", active:isRunning})} disabled={controlsDisabled}>Start</button>
            <button onClick={onPause}  className={btnCls({disabled:controlsDisabled,color:"amber", active:isPaused})}  disabled={controlsDisabled}>Pause</button>
            <button onClick={onResume} className={btnCls({disabled:controlsDisabled,color:"indigo",active:isRunning&&!isPaused})} disabled={controlsDisabled}>Resume</button>
            <button onClick={onStop}   className={btnCls({disabled:controlsDisabled,color:"rose",  active:isStopped})} disabled={controlsDisabled}>Stop</button>
            <button onClick={onReset}  className={btnCls({disabled:controlsDisabled,color:"slate"})} disabled={controlsDisabled}>Reset</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* LEFT */}
          <div className="space-y-4">
            {/* Connection */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="font-medium mb-2">Connection</div>
              <div className="space-y-2">
                <label className="text-xs">Email</label>
                <input className="w-full input" value={connection.email} onChange={(e)=>setConnection({...connection, email:e.target.value})}/>
                <label className="text-xs">Password</label>
                <input type="password" className="w-full input" value={connection.password} onChange={(e)=>setConnection({...connection, password:e.target.value})}/>
                <label className="text-xs">Account Type</label>
                <select className="w-full input" value={connection.accountType} onChange={(e)=>setConnection({...connection, accountType:e.target.value as AccountType})}>
                  <option value="PRACTICE">PRACTICE</option><option value="REAL">REAL</option>
                </select>
                <div className="flex items-center justify-between pt-2">
                  <div className={cx("px-2 py-0.5 rounded text-xs", connection.connected ? "bg-green-100":"bg-slate-100")}>
                    {connection.connected ? "Connected":"Disconnected"}
                  </div>
                  <button onClick={onToggleConnect} className="px-3 py-1 rounded bg-slate-200 text-xs">
                    {connection.connected ? "Disconnect":"Connect"}
                  </button>
                </div>
              </div>
            </div>

            {/* Bot Control */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="font-medium mb-2">Bot Control</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">Order Duration</label>
                  <select className="w-full input" value={cfg.orderDuration} onChange={(e)=>setCfg({...cfg, orderDuration:e.target.value})}>
                    <option>1 Minute</option><option>3 Minutes</option><option>5 Minutes</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs">Amount ($)</label>
                  <input className="w-full input" type="number" min={1} value={cfg.amount} onChange={(e)=>setCfg({...cfg, amount:Number(e.target.value)})}/>
                </div>
                <div>
                  <label className="text-xs">Interval (ms)</label>
                  <input className="w-full input" type="number" min={1000} step={1000} value={cfg.internalMs} onChange={(e)=>setCfg({...cfg, internalMs:Number(e.target.value)})}/>
                </div>
                <div>
                  <label className="text-xs">Assets (CSV)</label>
                  <input className="w-full input" value={cfg.assetsCsv} onChange={(e)=>setCfg({...cfg, assetsCsv:e.target.value})}/>
                </div>
                <div>
                  <label className="text-xs">Strategy</label>
                  <input className="w-full input" value={cfg.strategy} onChange={(e)=>setCfg({...cfg, strategy:e.target.value as any})}/>
                </div>
                <div>
                  <label className="text-xs">Base Equity</label>
                  <input className="w-full input" type="number" value={cfg.baseEquityInput}
                    onChange={(e)=>{ const v=Number(e.target.value); setCfg({...cfg, baseEquityInput:v}); basePeakRef.current=v; }}/>
                </div>
              </div>

              {/* Equity Trio */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="p-2 rounded bg-slate-50 border"><div className="text-xs opacity-70">Base Equity</div><div className="text-lg font-semibold">{fmtMoney(baseEquity)}</div></div>
                <div className="p-2 rounded bg-slate-50 border"><div className="text-xs opacity-70">Realized P/L</div>
                  <div className={cx("text-lg font-semibold", realizedPL>=0?"text-green-600":"text-rose-600")}>
                    {(realizedPL>=0?"+":"")}{fmtMoney(Math.abs(realizedPL))}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-50 border"><div className="text-xs opacity-70">Equity (Live)</div>
                  <div className="text-lg font-semibold">{fmtMoney(equityLive)}</div>
                  <div className="text-[10px] opacity-60">Peak: {fmtMoney(basePeakRef.current)}</div>
                </div>
              </div>
            </div>

            {/* Guard Settings */}
            <div className="rounded-lg bg-white shadow p-4 space-y-3">
              <div className="font-medium mb-1">Guard Settings</div>

              {/* Reference & Cooldown */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">Reference</label>
                  <select className="w-full input" value={refMode} onChange={(e)=>setRefMode(e.target.value as RefMode)}>
                    <option>Peak</option><option>Base</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs">Cooldown Auto-Resume (min)</label>
                  <div className="flex gap-2">
                    <input className="w-full input" type="number" min={1} value={cooldown.minutes} onChange={(e)=>setCooldown({...cooldown, minutes:Number(e.target.value)})}/>
                    <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={cooldown.enabled} onChange={(e)=>setCooldown({...cooldown, enabled:e.target.checked})}/> Enabled</label>
                  </div>
                </div>
              </div>

              {/* Drawdown Guard */}
              <div className="border rounded p-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">Risk Guard — Drawdown</div>
                  <label className="text-xs flex items-center gap-1">
                    <input type="checkbox" checked={guard.enabled} onChange={(e)=>setGuard({...guard, enabled:e.target.checked})}/> Enabled
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-xs">Mode</label>
                    <select className="w-full input" value={guard.mode} onChange={(e)=>setGuard({...guard, mode:e.target.value as GuardMode})}>
                      <option>Percent</option><option>Value</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs">Value (%) or ($)</label>
                    <input className="w-full input" type="number" value={guard.value} onChange={(e)=>setGuard({...guard, value:Number(e.target.value)})}/>
                  </div>
                </div>
                <div className="mt-2 text-xs opacity-70">Drawdown: {ddPct.toFixed(2)}% ({fmtMoney(ddMoney)}) / Ref: {refMode==="Peak"?fmtMoney(basePeakRef.current):fmtMoney(baseEquity)}</div>
                <div className="h-2 bg-slate-200 rounded overflow-hidden mt-1"><div className="h-2 bg-rose-400" style={{ width: `${ddUsed}%` }} /></div>
              </div>

              {/* Profit Target Guard */}
              <div className="border rounded p-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">Profit Target Guard</div>
                  <label className="text-xs flex items-center gap-1">
                    <input type="checkbox" checked={pGuard.enabled} onChange={(e)=>setPGuard({...pGuard, enabled:e.target.checked})}/> Enabled
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-xs">Mode</label>
                    <select className="w-full input" value={pGuard.mode} onChange={(e)=>setPGuard({...pGuard, mode:e.target.value as ProfitGuardMode})}>
                      <option>Percent</option><option>Value</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs">Value (%) or ($)</label>
                    <input className="w-full input" type="number" value={pGuard.value} onChange={(e)=>setPGuard({...pGuard, value:Number(e.target.value)})}/>
                  </div>
                  <div>
                    <label className="text-xs">Action</label>
                    <select className="w-full input" value={pGuard.action} onChange={(e)=>setPGuard({...pGuard, action:e.target.value as ProfitAction})}>
                      <option>Pause</option><option>Stop</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 text-xs opacity-70">Profit: {pfPct.toFixed(2)}% ({fmtMoney(pfMoney)}) from {refMode}</div>
                <div className="h-2 bg-slate-200 rounded overflow-hidden mt-1"><div className="h-2 bg-emerald-400" style={{ width: `${pfUsed}%` }} /></div>
              </div>
            </div>

            {/* Guard Log */}
            <div className="rounded-lg bg-white shadow p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Guard Log</div>
                <button onClick={exportGuardLog} className="px-2 py-1 rounded bg-slate-800 text-white text-xs">Export</button>
              </div>
              <div className="max-h-48 overflow-auto mt-2">
                <table className="w-full text-xs">
                  <thead><tr className="text-left"><th className="p-1">Time</th><th className="p-1">Reason</th><th className="p-1">Detail</th></tr></thead>
                  <tbody>
                    {glog.length===0 && <tr><td className="p-2 text-slate-500" colSpan={3}>No guard events</td></tr>}
                    {glog.map((g,i)=>(<tr key={i} className="border-t"><td className="p-1">{new Date(g.time).toLocaleString()}</td><td className="p-1">{g.reason}</td><td className="p-1">{g.detail}</td></tr>))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="md:col-span-2 space-y-4">
             {/* ⬇️ เพิ่มบล็อก Session Stats ตรงนี้ */}
             <SessionStats
             trades={trades}
             baseEquity={baseEquity}
             realizedPL={realizedPL}
             title="Session Stats"
            />
            <div className="rounded-lg bg-white shadow p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Asset Live Board <span className="text-xs opacity-60">(mock ทุก 2 วินาที)</span></div>
                <button onClick={()=>{
                  const text = makeCSV(trades);
                  const ts = new Date().toISOString().slice(0,19).replace(/[-:T]/g,"");
                  downloadCSV(`angelbot_trades_${ts}.csv`, text);
                }} className="px-3 py-1 rounded bg-slate-800 text-white text-xs">Export CSV</button>
              </div>
              <div className="text-xs opacity-60">Streamed from server every 60s — or live via SSE</div>
            </div>

            <div className="rounded-lg bg-white shadow p-4">
              <div className="font-medium mb-2">Trade History</div>
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
                    {trades.map((t, idx)=>(
                      <tr key={t.id} className="border-t">
                        <td className="p-2">{idx+1}</td>
                        <td className="p-2">{new Date(t.timestamp).toLocaleString()}</td>
                        <td className="p-2">{t.asset}</td>
                        <td className="p-2"><span className={cx("px-2 py-0.5 rounded text-xs", t.direction==="CALL"?"bg-emerald-100":"bg-rose-100")}>{t.direction}</span></td>
                        <td className="p-2">{fmtMoney(t.amount)}</td>
                        <td className="p-2">{t.mgStep}</td>
                        <td className="p-2">{t.duration}</td>
                        <td className="p-2"><span className={cx("px-2 py-0.5 rounded text-xs", t.result==="WIN"?"bg-emerald-100":t.result==="LOSE"?"bg-rose-100":t.result==="EQUAL"?"bg-slate-100":"bg-amber-100")}>{t.result}</span></td>
                        <td className={cx("p-2 font-medium", (t.result_pl??0)>0?"text-emerald-600":(t.result_pl??0)<0?"text-rose-600":"text-slate-600")}>
                          {(t.result_pl??0)>0?"+":""}{fmtMoney(t.result_pl??0)}
                        </td>
                        <td className="p-2">{t.strategy}</td>
                      </tr>
                    ))}
                    {trades.length===0 && (<tr><td className="p-4 text-center text-slate-500" colSpan={10}>No trades yet</td></tr>)}
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
