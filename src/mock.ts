// --- mock.ts ---
/** แจกแจงผลลัพธ์ mock: WIN 52% / LOSE 40% / DRAW 8% + payout ~0.87 */
export function mockResolve(): { result: "WIN" | "LOSE" | "DRAW"; payout: number } {
  const r = Math.random();
  const payout = 0.87;
  if (r < 0.52) return { result: "WIN", payout };
  if (r < 0.92) return { result: "LOSE", payout }; // 0.52-0.92 => 40%
  return { result: "DRAW", payout }; // 8%
}
