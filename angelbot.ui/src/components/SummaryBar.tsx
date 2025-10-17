// angelbot.ui/src/components/SummaryBar.tsx
import { useMemo } from "react";
import type { Trade } from "../types";

export default function SummaryBar({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => {
    if (!trades.length) {
      return { win: 0, total: 0, winrate: 0, pnl: 0, maxdd: 0, avgpayout: 0 };
    }

    let pnl = 0, peak = 0, dd = 0, maxdd = 0, win = 0, payoutSum = 0, payoutCnt = 0;

    // เดินตามลำดับเวลาเก่า->ใหม่
    for (const t of [...trades].reverse()) {
      pnl += t.profit;
      peak = Math.max(peak, pnl);
      dd = peak - pnl;
      maxdd = Math.max(maxdd, dd);
      if (t.result === 'WIN') {
        win++;
        payoutSum += t.profit;
        payoutCnt++;
      }
    }

    const total = trades.filter(t => t.result !== 'PENDING').length;

    return {
      win,
      total,
      winrate: total ? Math.round((win / total) * 1000) / 10 : 0,
      pnl,
      maxdd,
      avgpayout: payoutCnt ? Math.round((payoutSum / payoutCnt) * 100) / 100 : 0,
    };
  }, [trades]);

  return (
    <div className="flex flex-wrap gap-4 text-sm border p-2 rounded">
      <div>WinRate: <b>{stats.winrate}%</b></div>
      <div>PnL: <b>{stats.pnl.toFixed(2)}</b></div>
      <div>Max DD: <b>{stats.maxdd.toFixed(2)}</b></div>
      <div>Avg Payout: <b>{stats.avgpayout.toFixed(2)}</b></div>
      <div>Trades: <b>{stats.total}</b></div>
    </div>
  );
}
