import React, { useMemo } from "react";
import type { Trade } from "../types";

type Props = {
  trades: Trade[];
  baseEquity: number;
  realizedPL: number;
  title?: string;
};

function fmt(n: number) { return n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function money(n: number) { return (n >= 0 ? "+" : "") + "$" + fmt(n); }
function pct(n: number) { return fmt(n) + "%"; }

export default function SessionStats({ trades, baseEquity, realizedPL, title = "Session Stats" }: Props) {
  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter(t => t.result === "WIN").length;
    const loses = trades.filter(t => t.result === "LOSE").length;
    const equals = trades.filter(t => t.result === "EQUAL").length;

    const grossProfit = trades.reduce((s, t) => s + Math.max(0, t.result_pl ?? 0), 0);
    const grossLoss   = trades.reduce((s, t) => s + Math.min(0, t.result_pl ?? 0), 0);
    const net         = grossProfit + grossLoss;

    const winRate = total ? (wins / total) * 100 : 0;
    const avgPerTrade = total ? net / total : 0;

    // equity path & drawdown
    let equity = baseEquity;
    let peak = baseEquity;
    let trough = baseEquity;
    let maxDD = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      equity += trades[i].result_pl ?? 0;
      if (equity > peak) peak = equity;
      if (equity < trough) trough = equity;
      const dd = peak - equity;
      if (dd > maxDD) maxDD = dd;
    }
    const maxDDPct = peak > 0 ? (maxDD / peak) * 100 : 0;

    // streaks
    let bestWinStreak = 0, bestLoseStreak = 0, curW = 0, curL = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      const r = trades[i].result;
      if (r === "WIN") { curW++; bestWinStreak = Math.max(bestWinStreak, curW); curL = 0; }
      else if (r === "LOSE") { curL++; bestLoseStreak = Math.max(bestLoseStreak, curL); curW = 0; }
      else { curW = 0; curL = 0; }
    }

    const startedAt = trades[trades.length-1]?.timestamp ?? null;
    const lastAt = trades[0]?.timestamp ?? null;

    return {
      total, wins, loses, equals,
      winRate, grossProfit, grossLoss, net, avgPerTrade,
      peak, trough, maxDD, maxDDPct,
      bestWinStreak, bestLoseStreak,
      startedAt, lastAt,
      equityNow: baseEquity + realizedPL,
    };
  }, [trades, baseEquity, realizedPL]);

  function exportStats() {
    const rows = [
      ["Metric","Value"],
      ["Total trades", String(stats.total)],
      ["Wins", String(stats.wins)],
      ["Loses", String(stats.loses)],
      ["Equals", String(stats.equals)],
      ["Win rate", pct(stats.winRate)],
      ["Gross profit", money(stats.grossProfit)],
      ["Gross loss", money(stats.grossLoss)],
      ["Net P/L", money(stats.net)],
      ["Avg / trade", money(stats.avgPerTrade)],
      ["Peak equity", "$" + fmt(stats.peak)],
      ["Trough equity", "$" + fmt(stats.trough)],
      ["Max drawdown", "$" + fmt(stats.maxDD)],
      ["Max drawdown %", pct(stats.maxDDPct)],
      ["Best win streak", String(stats.bestWinStreak)],
      ["Best lose streak", String(stats.bestLoseStreak)],
      ["Started at", stats.startedAt ? new Date(stats.startedAt).toLocaleString() : "-"],
      ["Last trade", stats.lastAt ? new Date(stats.lastAt).toLocaleString() : "-"],
      ["Equity (now)", "$" + fmt(stats.equityNow)],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0,19).replace(/[-:T]/g,"");
    a.href = url; a.download = `angelbot_session_stats_${ts}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg bg-white shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{title}</div>
        <button onClick={exportStats} className="px-2 py-1 rounded bg-slate-800 text-white text-xs">
          Export Stats CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <Stat label="Total" value={stats.total} />
        <Stat label="Wins" value={stats.wins} accent="text-emerald-600" />
        <Stat label="Loses" value={stats.loses} accent="text-rose-600" />
        <Stat label="Equals" value={stats.equals} />

        <Stat label="Win rate" value={pct(stats.winRate)} />
        <Stat label="Net P/L" value={money(stats.net)} accent={stats.net>=0?"text-emerald-600":"text-rose-600"} />
        <Stat label="Avg / trade" value={money(stats.avgPerTrade)} />
        <Stat label="Gross +" value={money(stats.grossProfit)} accent="text-emerald-600" />

        <Stat label="Gross -" value={money(stats.grossLoss)} accent="text-rose-600" />
        <Stat label="Peak" value={"$"+fmt(stats.peak)} />
        <Stat label="Trough" value={"$"+fmt(stats.trough)} />
        <Stat label="Max DD" value={`${"$"+fmt(stats.maxDD)} (${pct(stats.maxDDPct)})`} />

        <Stat label="Best win streak" value={stats.bestWinStreak} />
        <Stat label="Best lose streak" value={stats.bestLoseStreak} />
        <Stat label="Started" value={stats.startedAt ? new Date(stats.startedAt).toLocaleTimeString() : "-"} />
        <Stat label="Last trade" value={stats.lastAt ? new Date(stats.lastAt).toLocaleTimeString() : "-"} />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="p-2 rounded border bg-slate-50">
      <div className="text-[11px] opacity-70">{label}</div>
      <div className={`text-base font-semibold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
