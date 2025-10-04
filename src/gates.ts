// --- gates.ts ---
import { TrendFilter, TF } from "./types";

/** อยู่ในช่วงเวลาที่อนุญาต (local time) */
export function isWithinTimeWindows(now: Date, windows: string[]): boolean {
  if (!windows || windows.length === 0) return true;
  const curMin = now.getHours() * 60 + now.getMinutes();

  for (const w of windows) {
    const [a, b] = (w || "").split("-").map((s) => s.trim());
    if (!a || !b) continue;
    const [ah, am] = a.split(":").map((n) => Number(n));
    const [bh, bm] = b.split(":").map((n) => Number(n));
    if ([ah, am, bh, bm].some((x) => Number.isNaN(x))) continue;
    const start = ah * 60 + am;
    const end = bh * 60 + bm;
    if (start <= end) {
      if (curMin >= start && curMin <= end) return true;
    } else {
      // คร่อมเที่ยงคืน เช่น 22:00-02:00
      if (curMin >= start || curMin <= end) return true;
    }
  }
  return false;
}

/** ยิงก่อนถึงนาที :00 ภายใน leadTimeSec วินาที */
export function hitLeadTime(now: Date, leadTimeSec: number): boolean {
  const s = now.getSeconds();
  if (!leadTimeSec || leadTimeSec <= 0) return true;
  return s >= 60 - Math.min(59, Math.floor(leadTimeSec));
}

/** mock trend filter ให้ผ่านตามโหมด (STRICT ผ่านน้อยกว่า WEAK) */
export async function trendFilterPass(_tf: TF, mode: TrendFilter): Promise<boolean> {
  if (mode === "OFF") return true;
  const r = Math.random();
  if (mode === "STRICT") return r < 0.7; // ~70%
  return r < 0.85; // WEAK ~85%
}

/** mock micro 5m filter */
export async function micro5mPass(enabled: boolean): Promise<boolean> {
  if (!enabled) return true;
  return Math.random() < 0.8; // ~80%
}
