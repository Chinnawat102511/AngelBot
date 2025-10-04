// --- mg.ts ---
import { MgConfig } from "./types";

/** สร้างลิสต์เงินสำหรับแต่ละชั้นตามโหมด MG */
export function buildMgList(cfg: MgConfig): number[] {
  const steps = Math.max(1, Math.floor(cfg.steps || 1));
  if (cfg.mode === "CUSTOM") {
    const cleaned = (cfg.customList || []).map((n) => Math.max(0, Number(n) || 0));
    return cleaned.length ? cleaned.slice(0, steps) : [cfg.base || 1];
  }
  if (cfg.mode === "MULTIPLIER") {
    const base = Math.max(0, Number(cfg.base) || 0);
    const mult = Math.max(1, Number(cfg.mult) || 1);
    const out: number[] = [];
    for (let i = 0; i < steps; i++) out.push(Number(base * Math.pow(mult, i)));
    return out;
  }
  // FIXED
  const base = Math.max(0, Number(cfg.base) || 0);
  return new Array(steps).fill(base);
}

/** กติกาเลื่อนชั้นตามผลลัพธ์ */
export function nextMgStep(current: number, result: "WIN"|"LOSE"|"DRAW", maxSteps: number): number {
  if (result === "WIN") return 1;
  if (result === "DRAW") return current; // คงเดิม
  return Math.min(maxSteps, current + 1); // LOSE -> +1
}
