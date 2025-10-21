import React from "react";
import type { Forecast } from "../types";

type Props = { f?: Forecast; onExport?: () => void };

function Pill({ color, text }: { color: string; text: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs text-white ${color}`}>{text}</span>;
}

export default function ForecastPanel({ f, onExport }: Props) {
  return (
    <div className="rounded-lg bg-white shadow p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">Angel Forecast</div>
        <button onClick={onExport} className="px-2 py-1 rounded bg-slate-800 text-white text-xs">
          Export
        </button>
      </div>

      {!f ? (
        <div className="text-sm text-slate-500 mt-2">Waiting for forecast…</div>
      ) : (
        <div className="grid grid-cols-5 gap-2 mt-2">
          <div>
            <div className="text-[11px] opacity-60">Symbol</div>
            <div className="text-sm font-medium">{f.symbol}</div>
          </div>
          <div>
            <div className="text-[11px] opacity-60">Horizon</div>
            <div className="text-sm font-medium">{f.horizonMin}m</div>
          </div>

          <div className="flex items-center gap-1">
            <div className="text-[11px] opacity-60">Risk</div>
            {f.risk === "high" && <Pill color="bg-rose-500" text="High" />}
            {f.risk === "medium" && <Pill color="bg-amber-500" text="Medium" />}
            {f.risk === "low" && <Pill color="bg-emerald-500" text="Low" />}
          </div>

          <div className="flex items-center gap-1">
            <div className="text-[11px] opacity-60">Bias</div>
            {f.bias === "CALL" && <Pill color="bg-emerald-600" text="CALL" />}
            {f.bias === "PUT" && <Pill color="bg-rose-600" text="PUT" />}
            {f.bias === "NEUTRAL" && <Pill color="bg-slate-600" text="NEUTRAL" />}
          </div>

          <div>
            <div className="text-[11px] opacity-60">Strength</div>
            <div className="text-sm font-medium">{Math.round(f.strength * 100)}%</div>
          </div>

          <div className="col-span-5 text-[12px] opacity-70 mt-1">Note: {f.note ?? "-"}</div>
          <div className="col-span-5 text-[11px] opacity-60">
            Updated: {new Date(f.ts).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
