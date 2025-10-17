// เบสกลยุทธ์แบบเบาๆ: คืนสัญญาณจากข้อมูลเทรดล่าสุด
import type { Trade } from "../types";

export type StrategyName = "baseline" | "followTrend" | "meanRevert";

export type StrategyDecision = "CALL" | "PUT" | "NEUTRAL";

export function decideSignal(name: StrategyName, recent: Trade[]): StrategyDecision {
  const t0 = recent[0]; // ล่าสุด
  if (!t0) return "NEUTRAL";

  switch (name) {
    case "baseline": {
      // สุ่ม 50/50 แต่ให้เป็น NEUTRAL 30% เพื่อลดสัญญาณมั่ว
      const r = Math.random();
      if (r < 0.35) return "CALL";
      if (r < 0.70) return "PUT";
      return "NEUTRAL";
    }
    case "followTrend": {
      // 3 ไม้ล่าสุด: win > lose → CALL, lose > win → PUT, เท่ากัน → ตามทิศทางล่าสุด
      const arr = recent.slice(0, 3);
      const win = arr.filter(t => t.result === "WIN").length;
      const lose = arr.filter(t => t.result === "LOSE").length;
      if (win > lose) return "CALL";
      if (lose > win) return "PUT";
      return (t0.direction ?? "CALL") as StrategyDecision;
    }
    case "meanRevert": {
      // แพ้ติด 2 → กลับทิศ, ชนะล่าสุด → กลับทิศหนึ่งไม้
      const t1 = recent[1];
      if (t0 && t1 && t0.result === "LOSE" && t1.result === "LOSE") {
        return t0.direction === "CALL" ? "PUT" : "CALL";
      }
      return t0.direction === "CALL" ? "PUT" : "CALL";
    }
  }
}
