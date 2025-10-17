// src/pages/index.tsx
import { useEffect, useMemo, useState } from "react";
import {
  getTrades,
  getState,
  startBot,
  pauseBot,
  resumeBot,
  resetData,
  openTradesSSE,
} from "../api";
import type { Trade } from "../types";
import { normalizeTrade } from "../types";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

export default function IndexPage() {
  // ----- UI state ที่ "ล็อกชื่อ" แล้ว -----
  const [trades, setTrades] = useState<Trade[]>([]);
  const [paused, setPaused] = useState(false);
  const [equity, setEquity] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(true); // server ของเรารัน loop เองอยู่แล้ว

  // winrate จากข้อมูลในตาราง
  const winrate = useMemo(() => {
    const w = trades.filter((t) => t.result === "WIN").length;
    const l = trades.filter((t) => t.result === "LOSE").length;
    const total = w + l;
    return total > 0 ? Math.round((w / total) * 100) : 0;
  }, [trades]);

  // ----- initial load + SSE subscribe -----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [t, s] = await Promise.all([getTrades(200), getState()]);
        if (cancelled) return;

        // getTrades อาจคืน Ok{trades} หรือ array ตรง ๆ → normalize ให้เป็น Trade[]
        const listRaw = Array.isArray(t) ? t : (t as any)?.trades ?? [];
        setTrades(listRaw.map((x: any) => normalizeTrade(x)));

        setPaused(Boolean((s as any)?.engine?.paused));
        setRunning(Boolean((s as any)?.engine?.running ?? true));
        setEquity(Number((s as any)?.equity ?? 0));
      } catch {
        // เงียบไว้ หน้า UI ยังใช้งานได้
      }
    })();

    // subscribe SSE (NEW/UPDATE/ENGINE_STATUS/RESET)
    const es = openTradesSSE();
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "NEW") {
          setTrades((prev) => [normalizeTrade(msg.payload), ...prev]);
        } else if (msg?.type === "UPDATE") {
          const up = normalizeTrade(msg.payload);
          setTrades((prev) => {
            const i = prev.findIndex((x) => x.id === up.id);
            if (i === -1) return prev;
            const next = prev.slice();
            next[i] = up;
            return next;
          });
          // อัปเดต equity/ผลรวมแบบคร่าว ๆ จากผล trade
          if (typeof up.profit === "number") {
            setEquity((e) => e + up.profit);
          }
        } else if (msg?.type === "ENGINE_STATUS") {
          if (typeof msg.payload?.paused === "boolean") {
            setPaused(msg.payload.paused);
          }
          if (typeof msg.payload?.running === "boolean") {
            setRunning(msg.payload.running);
          }
        } else if (msg?.type === "RESET") {
          setTrades([]);
          setEquity(0);
        }
      } catch {
        // ignore
      }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  // ----- handlers (ชื่อฟังก์ชัน “ล็อก” ไว้แล้ว) -----
  const onStart = async () => {
    setBusy(true);
    try {
      await startBot({
        seed: 777,
        amount_mode: "percent",
        amount_percent: 1.5,
        daily_stop_loss: -200,
        daily_take_profit: 400,
        max_concurrent_pending: 1,
        mg_steps: 2,
        mg_multiplier: 2.0,
        mg_cap: 2,
        asset_cycle: ["XAUUSD", "EURUSD"],
        duration: 1,
        strategy: "Baseline",
        interval_ms: 60_000,
        equity_base: 1000,
      });
      setRunning(true);
      setPaused(false);
    } finally {
      setBusy(false);
    }
  };

  const onPauseResume = async () => {
    setBusy(true);
    try {
      if (paused) {
        await resumeBot();
        setPaused(false);
      } else {
        await pauseBot();
        setPaused(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    setBusy(true);
    try {
      await resetData();
      setTrades([]);
      setEquity(0);
    } finally {
      setBusy(false);
    }
  };

  // ----- UI (เรียบง่าย, คงที่) -----
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">AngelBot Dashboard</h1>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onStart}
          disabled={busy}
          className="px-3 py-2 rounded bg-gray-200"
          title="Start bot"
        >
          Start
        </button>

        <button
          onClick={onPauseResume}
          disabled={busy}
          className="px-3 py-2 rounded bg-gray-200"
          title={paused ? "Resume bot" : "Pause bot"}
        >
          {paused ? "Resume" : "Pause"}
        </button>

        <button
          onClick={onReset}
          disabled={busy}
          className="px-3 py-2 rounded bg-red-200"
          title="Reset trades & equity"
        >
          Reset data
        </button>

        <div className="ml-4 text-sm opacity-70">
          Status: <b>{paused ? "PAUSED" : running ? "RUNNING" : "STOPPED"}</b>
        </div>
        <div className="ml-4 text-sm opacity-70">Equity: {equity}</div>
        <div className="ml-4 text-sm opacity-70">Win rate: {winrate}%</div>
      </div>

      {/* Table */}
      {trades.length === 0 ? (
        <div className="text-sm opacity-70">No records.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm min-w-[760px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-3">Time</th>
                <th className="py-1 pr-3">Asset</th>
                <th className="py-1 pr-3">Dir</th>
                <th className="py-1 pr-3">MG</th>
                <th className="py-1 pr-3">Amount</th>
                <th className="py-1 pr-3">Strategy</th>
                <th className="py-1 pr-3">Dur</th>
                <th className="py-1 pr-3">Result</th>
                <th className="py-1 pr-3">Profit</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-1 pr-3">{fmtTime(t.timestamp)}</td>
                  <td className="py-1 pr-3">{t.asset}</td>
                  <td className="py-1 pr-3">{t.direction}</td>
                  <td className="py-1 pr-3">MG{t.mg_step}</td>
                  <td className="py-1 pr-3">{t.amount}</td>
                  <td className="py-1 pr-3">{t.strategy}</td>
                  <td className="py-1 pr-3">{t.duration}m</td>
                  <td
                    className={`py-1 pr-3 ${
                      t.result === "WIN"
                        ? "text-green-700"
                        : t.result === "LOSE"
                        ? "text-red-700"
                        : "text-gray-700"
                    }`}
                  >
                    {t.result}
                  </td>
                  <td className="py-1 pr-3">{t.profit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
