import React, { useEffect, useMemo, useRef, useState } from "react";

type EngineStatus = { running: boolean; intervalMs: number; trades: number };
type AutoStatus = {
  running: boolean;
  cfg: {
    symbol: string; tf: string; qty: number; intervalMs: number;
    emaFast: number; emaSlow: number; basePrice: number; vol: number;
    owner: string; meanRev: number; hysteresis: number;
  };
  state: { lastPrice: number | null; emaFast: number | null; emaSlow: number | null };
};
type Trade = {
  id: string; ts: string; symbol: string; side: "BUY" | "SELL";
  qty: number; price?: number; owner?: string; note?: string; source?: string;
};
type Health = { ok: boolean; service: string; time: string; license_base: string };

const API_BASE = "http://localhost:5050";

export default function AngelBotDashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [auto, setAuto] = useState<AutoStatus | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState({
    symbol: "EURUSD", qty: 1, intervalMs: 1200,
    emaFast: 5, emaSlow: 12, basePrice: 1.1, vol: 0.0015,
  });
  const timer = useRef<number | null>(null);

  const fetcher = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, { ...init });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  };

  const loadAll = async () => {
    try {
      const [h, e, a, ts] = await Promise.all([
        fetcher<Health>("/health"),
        fetcher<{ ok: boolean; status: EngineStatus }>("/engine/status").then(r => r.status),
        fetcher<{ ok: boolean; auto: AutoStatus; engine: EngineStatus }>("/auto/status").then(r => r.auto),
        fetcher<{ ok: boolean; trades: Trade[] }>("/engine/trades?limit=20").then(r => r.trades),
      ]);
      setHealth(h); setEngine(e); setAuto(a); setTrades(ts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAll();
    timer.current = window.setInterval(loadAll, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const startEngine = async () => {
    setLoading(true);
    try {
      await fetcher("/engine/start", { method: "POST" });
      await loadAll();
    } finally { setLoading(false); }
  };

  const stopEngine = async () => {
    setLoading(true);
    try {
      await fetcher("/engine/stop", { method: "POST" });
      await loadAll();
    } finally { setLoading(false); }
  };

  const startAuto = async () => {
    setLoading(true);
    try {
      await fetcher("/auto/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      await loadAll();
    } finally { setLoading(false); }
  };

  const stopAuto = async () => {
    setLoading(true);
    try {
      await fetcher("/auto/stop", { method: "POST" });
      await loadAll();
    } finally { setLoading(false); }
  };

  const patchAuto = async () => {
    setLoading(true);
    try {
      await fetcher("/auto/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      await loadAll();
    } finally { setLoading(false); }
  };

  const badge = (on: boolean | undefined) => (
    <span className={`px-2 py-0.5 rounded-full text-xs ${on ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {on ? "RUNNING" : "STOPPED"}
    </span>
  );

  const price = auto?.state.lastPrice ?? null;
  const ef = auto?.state.emaFast ?? null;
  const es = auto?.state.emaSlow ?? null;

  const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="p-4 rounded-2xl shadow-sm bg-white border">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AngelBot Dashboard</h1>
            <p className="text-sm text-gray-500">Engine @ {API_BASE} · License: {health?.license_base ?? "—"}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAll}
              className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-100 disabled:opacity-50"
              disabled={loading}
            >Refresh</button>
          </div>
        </header>

        {/* Top status cards */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Engine" value={<div className="flex items-center gap-2">{badge(engine?.running)}<span className="text-sm">interval {engine?.intervalMs ?? "—"}ms</span></div>} />
          <Stat label="AutoTrader" value={<div className="flex items-center gap-2">{badge(auto?.running)}<span className="text-sm">{auto?.cfg.symbol ?? "—"}</span></div>} />
          <Stat label="Last Price" value={price ? price.toFixed(5) : "—"} />
          <Stat label="EMA (fast/slow)" value={(ef && es) ? `${ef.toFixed(5)} / ${es.toFixed(5)}` : "—"} />
        </section>

        {/* Controls */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white border shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Engine Controls</h2>
              <div className="flex gap-2">
                <button onClick={startEngine} disabled={loading}
                        className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50">Start</button>
                <button onClick={stopEngine} disabled={loading}
                        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-100 disabled:opacity-50">Stop</button>
              </div>
            </div>
            <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl overflow-auto">
{JSON.stringify({ engine, health }, null, 2)}
            </pre>
          </div>

          <div className="p-4 rounded-2xl bg-white border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">AutoTrader Controls</h2>
              <div className="flex gap-2">
                <button onClick={startAuto} disabled={loading}
                        className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50">Start</button>
                <button onClick={stopAuto} disabled={loading}
                        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-100 disabled:opacity-50">Stop</button>
              </div>
            </div>

            {/* Config form */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {([
                ["symbol","text"],["qty","number"],["intervalMs","number"],
                ["emaFast","number"],["emaSlow","number"],["basePrice","number"],["vol","number"],
              ] as const).map(([k, type]) => (
                <label key={k} className="text-xs text-gray-600 space-y-1">
                  <div className="uppercase">{k}</div>
                  <input
                    className="w-full px-2 py-2 rounded-xl border"
                    type={type}
                    step={k==="vol" ? "0.0001":"any"}
                    value={(cfg as any)[k]}
                    onChange={(e)=> setCfg(s => ({...s, [k]: type==="number" ? Number(e.target.value) : e.target.value}))}
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <button onClick={patchAuto} disabled={loading}
                      className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-100 disabled:opacity-50">Apply Config</button>
            </div>

            <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl overflow-auto">
{JSON.stringify(auto, null, 2)}
            </pre>
          </div>
        </section>

        {/* Trades table */}
        <section className="p-4 rounded-2xl bg-white border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent Trades</h2>
            <span className="text-xs text-gray-500">{trades.length} rows</span>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t=>(
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{new Date(t.ts).toLocaleTimeString()}</td>
                    <td className="py-2 pr-3">{t.symbol}</td>
                    <td className={`py-2 pr-3 font-semibold ${t.side==="BUY"?"text-green-600":"text-red-600"}`}>{t.side}</td>
                    <td className="py-2 pr-3">{t.qty}</td>
                    <td className="py-2 pr-3">{t.price?.toFixed?.(5) ?? "-"}</td>
                    <td className="py-2 pr-3">{t.owner ?? "-"}</td>
                    <td className="py-2 pr-3">{t.note ?? "-"}</td>
                  </tr>
                ))}
                {trades.length===0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-gray-400">No trades yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="text-center text-xs text-gray-400 pb-6">
          AngelBot © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
