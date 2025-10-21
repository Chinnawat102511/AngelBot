import React from "react";

export default function OfflineBanner(props: {
  mode: "disconnected" | "connecting" | "sse" | "polling";
  onRetry: () => void;
}) {
  const { mode, onRetry } = props;
  if (mode === "sse") return null;

  const text =
    mode === "connecting"
      ? "กำลังเชื่อมต่อสตรีม…"
      : mode === "polling"
      ? "สตรีมล่ม → ใช้โหมด Polling (ข้อมูลยังอัปเดต แต่ไม่ real-time)"
      : "ออฟไลน์ / ยังไม่เชื่อมต่อสตรีม";

  const tone =
    mode === "polling" ? "bg-amber-50 text-amber-800 border-amber-300"
    : mode === "connecting" ? "bg-sky-50 text-sky-800 border-sky-300"
    : "bg-rose-50 text-rose-800 border-rose-300";

  return (
    <div className={`border ${tone} px-3 py-2 rounded mb-3 flex items-center justify-between`}>
      <div className="text-sm">{text}</div>
      <button
        onClick={onRetry}
        className="px-2 py-1 rounded bg-slate-800 text-white text-xs"
        title="ลองเชื่อมต่อ SSE ใหม่"
      >
        Retry SSE
      </button>
    </div>
  );
}
