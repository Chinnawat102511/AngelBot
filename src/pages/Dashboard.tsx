// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { EngineStatus, Trade } from '../types';
import {
  getStatus,
  startEngine,
  stopEngine,
  quickOrder,
  getTrades,
  clearTrades,
  pingHealth,
} from '../api/index';

import {
  LicenseBar,
  ConnectionPanel,
  BotControl,
  AssetsSelector,
  FiltersPanel,
  MartingalePanel,
  RiskPanel,
  KPIBoxes,
  AssetLiveBoard,
  AiModelStatus,
  Scheduler as SchedulerPanel,
  ConsoleTabs,
} from '../components';

export default function Dashboard() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lastError, setLastError] = useState<string>('');
  const [busy, setBusy] = useState({
    start: false,
    stop: false,
    quick: false,
    refresh: false,
    connect: false,
    clear: false,
  });

  const refresh = useCallback(async () => {
    try {
      setBusy((b) => ({ ...b, refresh: true }));
      const s = await getStatus();
      setStatus(s.status);
      const t = await getTrades(100);
      setTrades(t.trades || []);
    } catch (e: any) {
      setLastError(String(e?.message ?? e));
    } finally {
      setBusy((b) => ({ ...b, refresh: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // polling เมื่อวิ่งอยู่
  useEffect(() => {
    if (!status?.running) return;
    const id = setInterval(() => {
      refresh();
    }, 1500);
    return () => clearInterval(id);
  }, [status?.running, refresh]);

  const onStart = async () => {
    if (busy.start) return;
    setBusy((b) => ({ ...b, start: true }));
    setLastError('');
    try {
      await startEngine();
      await refresh();
    } catch (e: any) {
      setLastError(String(e?.message ?? e));
    } finally {
      setBusy((b) => ({ ...b, start: false }));
    }
  };

  const onStop = async () => {
    if (busy.stop) return;
    setBusy((b) => ({ ...b, stop: true }));
    setLastError('');
    try {
      await stopEngine();
      await refresh();
    } catch (e: any) {
      setLastError(String(e?.message ?? e));
    } finally {
      setBusy((b) => ({ ...b, stop: false }));
    }
  };

  const onQuick = async (side: 'BUY' | 'SELL', symbol: string, amount: number) => {
    if (busy.quick || !status?.running) return;
    setBusy((b) => ({ ...b, quick: true }));
    setLastError('');
    try {
      await quickOrder(side, symbol, amount);
      await refresh(); // ไม่ไป setRunning(false)
    } catch (e: any) {
      setLastError(`Quick ${side} failed: ${e?.message ?? e}`);
    } finally {
      setBusy((b) => ({ ...b, quick: false }));
    }
  };

  const onClearTrades = async () => {
    if (busy.clear) return;
    setBusy((b) => ({ ...b, clear: true }));
    try {
      await clearTrades();
      await refresh();
    } finally {
      setBusy((b) => ({ ...b, clear: false }));
    }
  };

  const kpi = useMemo(() => {
    const win = trades.filter((t) => t.pnl > 0).length;
    const lose = trades.filter((t) => t.pnl < 0).length;
    const draw = trades.filter((t) => t.pnl === 0).length;
    const sessionPnl = trades.reduce((a, v) => a + v.pnl, 0);
    const maxMg = trades.reduce((m, t) => Math.max(m, t.mgStep ?? 0), 0);
    return { win, lose, draw, sessionPnl, maxMg, orders: trades.length };
  }, [trades]);

  return (
    <div className="mx-auto max-w-7xl p-4 space-y-4 text-sm">
      <LicenseBar
        onVerify={async () => {
          const r = await pingHealth();
          return { ok: !r?.error, message: r?.error ? String(r.error) : 'OK' };
        }}
      />

      <ConnectionPanel
        connected={!!status?.connected}
        balance={status?.balance ?? 0}
        accountType={status?.account_type ?? 'PRACTICE'}
        onConnect={async () => {
          setBusy((b) => ({ ...b, connect: true }));
          try {
            await refresh();
          } finally {
            setBusy((b) => ({ ...b, connect: false }));
          }
        }}
        busy={busy.connect}
      />

      <div className="rounded-2xl bg-neutral-900/40 p-4 space-y-4">
        <BotControl
          running={!!status?.running}
          onStart={onStart}
          onStop={onStop}
          onQuickBuy={(sym: string, amt: number) => onQuick('BUY', sym, amt)}
          onQuickSell={(sym: string, amt: number) => onQuick('SELL', sym, amt)}
          disabledQuick={!status?.running || busy.quick}
          updatedAt={new Date()}
        />

        <AssetsSelector selected={['EURUSD']} onChange={() => {}} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FiltersPanel loadTime={6} trend="Strict" micro="On" onChange={() => {}} />
          <RiskPanel dailyTP={20} dailySL={-20} maxOrders={100} onChange={() => {}} />
        </div>

        <MartingalePanel
          mode="Custom"
          base={1}
          steps={10}
          scope="Combined"
          rule="ตามสัญญาณล่าสุด"
          customList=""
          onChange={() => {}}
        />

        <KPIBoxes
          session={{
            orders: kpi.orders,
            win: kpi.win,
            lose: kpi.lose,
            draw: kpi.draw,
            maxMg: kpi.maxMg,
            pnl: kpi.sessionPnl,
          }}
          life={{
            orders: status?.stats.orders ?? 0,
            win: status?.stats.win ?? 0,
            lose: status?.stats.lose ?? 0,
            draw: status?.stats.draw ?? 0,
            maxMg: 1,
            pnl: status?.stats.session_pnl ?? 0,
          }}
        />

        <AssetLiveBoard
          rows={[
            { symbol: 'EURUSD', time: new Date(), status: 'Open', price: 1.08777, trend: 'Up' },
            { symbol: 'GBPUSD', time: new Date(), status: 'Open', price: 1.27691, trend: 'Up' },
          ]}
          onRefresh={refresh}
        />

        <AiModelStatus
          version="1.0.1"
          accuracy={56.1}
          winRate={52.5}
          lr={0.0019}
          autoRetrain={false}
          onRetrain={() => {}}
          onCalibrate={() => {}}
        />

        <SchedulerPanel
          start="09:00"
          stop="23:59"
          resetAt="06:00"
          workdays={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
          skipWeekend
          onChange={() => {}}
        />

        <ConsoleTabs
          trades={trades}
          logLines={lastError ? [`[error] ${lastError}`] : ['-']}
          onClearTrades={onClearTrades}
          busyClear={busy.clear}
        />
      </div>
    </div>
  );
}
