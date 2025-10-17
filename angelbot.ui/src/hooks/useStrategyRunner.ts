import { useEffect, useRef, useState } from "react";
import type { Trade } from "../types";

export type AutoAction = "start-pause" | "resume-pause";

export type AutoStrategyConfig = {
  enabled: boolean;
  name: string;
  window: number;
  minWinRate: number;
  action: AutoAction;
};

type Controller = {
  start: () => Promise<void> | void;
  resume: () => Promise<void> | void;
};

type StrategyDecision = "GO" | "HOLD";

function calcWinRate(trades: Trade[], n: number): number {
  if (n <= 0) return 0;
  const last = trades.slice(0, n); // trades เรียงใหม่สุดมาก่อนใน App
  if (last.length === 0) return 0;
  const win = last.filter((t) => t.result === "WIN").length;
  return (win / last.length) * 100;
}

export function useStrategyRunner(
  trades: Trade[],
  cfg: AutoStrategyConfig,
  connected: boolean,
  controller: Controller
) {
  const [lastDecision, setLastDecision] = useState<StrategyDecision>("HOLD");
  const [lastAction, setLastAction] = useState<string>("-");
  const busy = useRef(false);

  useEffect(() => {
    if (!cfg.enabled || !connected) return;
    if (busy.current) return;

    const wr = calcWinRate(trades, cfg.window);
    const decision: StrategyDecision = wr >= cfg.minWinRate ? "GO" : "HOLD";
    setLastDecision(decision);

    // ทำงานเบา ๆ กันปั่นทุกไม้
    if (decision === "GO") {
      busy.current = true;
      (async () => {
        try {
          if (cfg.action === "start-pause") {
            await Promise.resolve(controller.start());
            setLastAction("start()");
          } else {
            await Promise.resolve(controller.resume());
            setLastAction("resume()");
          }
        } catch {
          // no-op
        } finally {
          setTimeout(() => (busy.current = false), 1500); // cooldown กันถี่เกิน
        }
      })();
    }
  }, [trades, cfg, connected, controller]);

  return { lastDecision, lastAction };
}
