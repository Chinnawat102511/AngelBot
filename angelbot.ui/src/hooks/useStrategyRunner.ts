// angelbot.ui/src/hooks/useStrategyRunner.ts
import { useEffect, useRef, useState } from "react";
import type { Trade } from "../types";

/** โหมดทำงานอัตโนมัติ */
export type AutoAction = "start-pause" | "resume-pause";

/** คอนฟิกของกลยุทธ์อัตโนมัติ (paper) */
export type AutoStrategyConfig = {
  enabled: boolean;      // เปิด/ปิด
  name: string;          // ชื่อกลยุทธ์ (ไว้โชว์ UI)
  window: number;        // คำนวณ win-rate จาก N ไม้ล่าสุด
  minWinRate: number;    // win-rate ขั้นต่ำที่ต้องได้
  action: AutoAction;    // ถ้าเข้าเงื่อนไข GO ให้ "start" หรือ "resume"
};

/** ชุดคำสั่งควบคุมบอทที่ส่งมาจาก App */
export type Controller = {
  start:  () => Promise<void> | void;
  pause:  () => Promise<void> | void;   // ✅ ต้องมี pause
  resume: () => Promise<void> | void;
};

/** สถานะตัดสินใจล่าสุดของกลยุทธ์ */
export type StrategyDecision = "GO" | "HOLD";

/** คำนวณ win-rate จาก N ไม้ล่าสุด (trades เรียงใหม่ -> เก่า) */
function calcWinRate(trades: Trade[], n: number): number {
  if (!n || n <= 0) return 0;
  const slice = trades.slice(0, n);
  if (slice.length === 0) return 0;
  const wins = slice.filter((t) => t.result === "WIN").length;
  return (wins / slice.length) * 100;
}

/**
 * useStrategyRunner
 * - ดู win-rate ตามคอนฟิก
 * - ถ้าถึงเกณฑ์ ⇒ สั่ง start/resume ตาม action
 * - ถ้าไม่ถึง ⇒ สั่ง pause
 * - มีคูลดาวน์กันสั่งถี่เกิน และกันเด้งซ้ำ
 */
export function useStrategyRunner(
  trades: Trade[],
  cfg: AutoStrategyConfig,
  connected: boolean,
  controller: Controller
) {
  const [lastDecision, setLastDecision] = useState<StrategyDecision>("HOLD");
  const [lastAction, setLastAction] = useState<string>("-");
  const [lastWinRate, setLastWinRate] = useState<number>(0);

  const busy = useRef(false);
  // กันสั่งซ้ำติด ๆ กัน: สั่งอะไรล่าสุดไว้
  const lastCmdRef = useRef<"start" | "resume" | "pause" | null>(null);

  useEffect(() => {
    if (!cfg?.enabled) return;
    if (!connected) return; // ยังไม่ connect ก็ไม่ทำอะไร
    if (busy.current) return;

    const wr = calcWinRate(trades, cfg.window);
    setLastWinRate(wr);

    const decision: StrategyDecision = wr >= cfg.minWinRate ? "GO" : "HOLD";
    setLastDecision(decision);

    // ไม่ตกเงื่อนไขก็หยุด (pause)
    if (decision === "HOLD") {
      if (lastCmdRef.current !== "pause") {
        busy.current = true;
        Promise.resolve(controller.pause())
          .then(() => {
            setLastAction("pause()");
            lastCmdRef.current = "pause";
          })
          .finally(() => {
            setTimeout(() => (busy.current = false), 1000);
          });
      }
      return;
    }

    // ถ้า GO ให้ทำตามโหมด action
    const want: "start" | "resume" = cfg.action === "start-pause" ? "start" : "resume";
    if (lastCmdRef.current === want) return; // คำสั่งเดิมอยู่แล้ว ไม่ต้องยิงซ้ำ

    busy.current = true;
    (async () => {
      try {
        if (want === "start") {
          await Promise.resolve(controller.start());
          setLastAction("start()");
          lastCmdRef.current = "start";
        } else {
          await Promise.resolve(controller.resume());
          setLastAction("resume()");
          lastCmdRef.current = "resume";
        }
      } catch {
        // no-op
      } finally {
        // กันเด้งสั่งซ้ำบ่อย
        setTimeout(() => (busy.current = false), 1500);
      }
    })();
  }, [trades, cfg, connected, controller]);

  return { lastDecision, lastAction, lastWinRate };
}
