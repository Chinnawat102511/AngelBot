import { useEffect, useRef, useState } from "react";
import { getTrades, hasData, openTradesSSE } from "../api";
import type { Trade } from "../types";

type Mode = "disconnected" | "connecting" | "sse" | "polling";

export function useTradesStream(
  onOne: (t: Trade) => void,
  onSnapshot: (list: Trade[]) => void,
  opts?: { pollInterval?: number }
) {
  const pollEvery = opts?.pollInterval ?? 3000;

  const [mode, setMode] = useState<Mode>("disconnected");
  const stopSSERef = useRef<null | (() => void)>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopAll() {
    if (stopSSERef.current) { try { stopSSERef.current(); } catch {} }
    stopSSERef.current = null;
    if (pollRef.current) { clearInterval(pollRef.current); }
    pollRef.current = null;
    setMode("disconnected");
  }

  async function startPolling() {
    stopAll();
    setMode("polling");

    // ยิง snapshot รอบแรก
    try {
      const r = await getTrades();
      if (hasData(r)) onSnapshot(r.data);
    } catch {}

    pollRef.current = setInterval(async () => {
      try {
        const r = await getTrades();
        if (hasData(r)) onSnapshot(r.data);
      } catch {
        // เงียบ ๆ — ถ้าเน็ตสะดุดค่อยรีทรี
      }
    }, pollEvery);
  }

  function start() {
    stopAll();
    setMode("connecting");
    try {
      const stop = openTradesSSE(
        (t) => {
          if (mode !== "sse") setMode("sse");
          onOne(t);
        },
        (list) => {
          if (mode !== "sse") setMode("sse");
          onSnapshot(list);
        },
        // onError (ถ้า API ของพี่มี) → ใช้ fallback
      );
      stopSSERef.current = () => { try { stop(); } catch {} };
    } catch {
      // ถ้าเปิด EventSource fail → ตกไป Polling
      startPolling();
    }
  }

  // บังคับ fallback เป็น polling จากภายนอกก็ได้
  function forcePolling() {
    startPolling();
  }

  useEffect(() => () => stopAll(), []);

  return { mode, start, stop: stopAll, forcePolling };
}
