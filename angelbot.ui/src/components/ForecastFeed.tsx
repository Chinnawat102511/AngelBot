import React from "react";
import type { Forecast } from "../types";

type Props = {
  items: Forecast[];        // เก็บเป็น array ตามที่คุยกัน
  max?: number;             // จำนวนสูงสุดที่แสดง (เช่น 200)
  onClear?: () => void;     // ปุ่มล้าง feed (ถ้ามี)
};

// --- helpers: รองรับหลาย schema ของ feed ---
function labelOf(x: any): string {
  const v = (x?.label ?? x?.pred?.label ?? x?.direction ?? x?.type ?? "").toString().toUpperCase();
  if (v === "CALL" || v === "PUT" || v === "EQUAL" || v === "HOLD") return v;
  return v || "-";
}
function scoreOf(x: any): number | null {
  const v = x?.score ?? x?.pred?.score ?? x?.confidence ?? null;
  return typeof v === "number" ? v : null;
}
function tsOf(x: any): number {
  const v = x?.ts ?? x?.time ?? x?.timestamp ?? Date.now();
  return typeof v === "number" ? v : Date.parse(v) || Date.now();
}

function Badge({ text, tone = "slate" }: { text: string; tone?: "green"|"rose"|"indigo"|"amber"|"slate" }) {
  const map = {
    green: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700",
    amber: "bg-amber-100 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  } as const;
  return <span className={`text-xs px-2 py-0.5 rounded ${map[tone]}`}>{text}</span>;
}

export default function ForecastFeed({ items, max = 200, onClear }: Props) {
  // จำกัดรายการ
  const list = Array.isArray(items) ? items.slice(0, max) : [];

  // นับสถิติตาม label
  const stat = list.reduce(
    (acc, it) => {
      const lb = labelOf(it);
      acc.total++;
      if (lb in acc) (acc as any)[lb]++;
      return acc;
    },
    { total: 0, CALL: 0, PUT: 0, EQUAL: 0, HOLD: 0 } as {
      total: number; CALL: number; PUT: number; EQUAL: number; HOLD: number;
    }
  );

  // แปลงเป็นค่าบาร์สำหรับ sparkline (ใช้ score 0..1, ถ้าไม่มีให้ 0.5)
  const bars = list.slice(0, 60).map((it) => {
    const s = scoreOf(it);
    const v = s == null ? 0.5 : Math.max(0, Math.min(1, s));
    return Math.round(v * 100); // เปอร์เซ็นต์ความสูง
  });

  const last = list[0];
  const lastTs = last ? tsOf(last) : Date.now();
  const lastLabel = last ? labelOf(last) : "-";
  const lastScore = last ? scoreOf(last) : null;

  return (
    <div className="rounded-lg bg-white shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Forecast Feed (SSE)</div>
        <div className="flex items-center gap-2">
          <Badge text={`total ${stat.total}/${max}`} />
          <Badge text={`CALL ${stat.CALL}`} tone="green" />
          <Badge text={`PUT ${stat.PUT}`} tone="rose" />
          <Badge text={`EQUAL ${stat.EQUAL}`} tone="indigo" />
          <Badge text={`HOLD ${stat.HOLD}`} tone="amber" />
          {onClear && (
            <button
              onClick={onClear}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* last snapshot */}
      <div className="text-xs mb-2 opacity-70">
        last:&nbsp;
        {last
          ? `${new Date(lastTs ?? Date.now()).toLocaleTimeString()} • ${lastLabel}${
              lastScore != null ? ` • score ${lastScore}` : ""
            }`
          : "—"}
      </div>

      {/* sparkline */}
      <div className="h-20 bg-slate-50 border rounded p-2 overflow-hidden">
        <div className="h-full flex items-end gap-[2px]">
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-[3px] bg-slate-400"
              style={{ height: `${Math.max(8, h)}%` }}
              title={`${h}%`}
            />
          ))}
        </div>
      </div>

      {/* raw preview (debug) */}
      <pre className="text-xs bg-slate-50 p-2 rounded border overflow-auto max-h-40 mt-2">
        {list.length ? JSON.stringify(list.slice(0, 20), null, 2) : "— waiting feed —"}
      </pre>
    </div>
  );
}
