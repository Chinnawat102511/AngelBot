import React, { useMemo } from "react";
import type { Trade } from "../types";

function Box({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-white border shadow-sm">
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {sub ? <div className="text-[11px] opacity-60 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function sum<T>(arr: T[], f: (x: T) => number) { return arr.reduce((s, x) => s + f(x), 0); }

export default function SessionStats({
  trades,
  baseEquity,
  realizedPL,
  title = "Session Stats",
}: {
  trades: Trade[];
  baseEquity: number;
  realizedPL: number;
  title?: string;
}) {
  const stats = useMemo(() => {
    const total = trades.length;
    const win = trades.filter(t => t.result === "WIN").length;
    const lose = trades.filter(t => t.result === "LOSE").length;
    const equal = trades.filter(t => t.result === "EQUAL").length;
    const gross = sum(trades, t => t.result_pl);
    const avg = total ? gross / total : 0;
    const peak = trades.length ? Math.max(...trades.map((_, i) =>
      baseEquity + sum(trades.slice(0, i + 1), t => t.result_pl)
    )) : baseEquity;
    const trough = trades.length ? Math.min(...trades.map((_, i) =>
      baseEquity + sum(trades.slice(0, i + 1), t => t.result_pl)
    )) : baseEquity;

    return { total, win, lose, equal, gross, avg, peak, trough };
  }, [trades, baseEquity]);

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="rounded-lg bg-white shadow p-4">
      <div className="font-medium mb-2">{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Box label="Total" value={stats.total} />
        <Box label="Wins" value={stats.win} />
        <Box label="Losses" value={stats.lose} />
        <Box label="Equal" value={stats.equal} />

        <Box label="Win %" value={`${stats.total ? ((stats.win / stats.total) * 100).toFixed(2) : "0.00"}%`} />
        <Box label="Net P/L" value={<span className={stats.gross >= 0 ? "text-emerald-600" : "text-rose-600"}>
          {(stats.gross >= 0 ? "+" : "") + fmt(stats.gross)}
        </span>} />
        <Box label="Avg / trade" value={fmt(stats.avg)} />
        <Box label="Realized P/L" value={<span className={realizedPL >= 0 ? "text-emerald-600" : "text-rose-600"}>
          {(realizedPL >= 0 ? "+" : "") + fmt(realizedPL)}
        </span>} />

        <Box label="Peak Equity" value={fmt(stats.peak)} sub={`from base ${fmt(baseEquity)}`} />
        <Box label="Trough Equity" value={fmt(stats.trough)} />
      </div>
    </div>
  );
}
