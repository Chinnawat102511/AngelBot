// src/components/BotControl.tsx
import { useState, type ChangeEvent } from 'react';
import type { TF } from '../types';

type Props = {
  running: boolean;
  updatedAt: Date;
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onQuickBuy: (symbol: string, amount: number) => void | Promise<void>;
  onQuickSell: (symbol: string, amount: number) => void | Promise<void>;
  disabledQuick?: boolean;
};

export default function BotControl(p: Props) {
  const [tf, setTf] = useState<TF>('1m');
  const [intervalSec, setIntervalSec] = useState<number>(6);
  const [symbol, setSymbol] = useState<string>('EURUSD');
  const [amt, setAmt] = useState<number>(1);

  const onChangeAmt = (e: ChangeEvent<HTMLInputElement>) =>
    setAmt(Math.max(1, Number(e.target.value || 1)));

  const onChangeInterval = (e: ChangeEvent<HTMLInputElement>) =>
    setIntervalSec(Math.max(0, Number(e.target.value || 0)));

  const onChangeSymbol = (e: ChangeEvent<HTMLInputElement>) =>
    setSymbol(e.target.value.toUpperCase());

  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4 space-y-3">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-2">
          <label className="text-xs opacity-70">TF</label>
          <select
            className="w-full rounded-lg bg-neutral-800 px-2 py-2"
            value={tf}
            onChange={(e) => setTf(e.target.value as TF)}
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs opacity-70">Interval (sec)</label>
          <input
            className="w-full rounded-lg bg-neutral-800 px-3 py-2"
            type="number"
            value={intervalSec}
            onChange={onChangeInterval}
            min={0}
          />
        </div>
        <div className="col-span-3">
          <label className="text-xs opacity-70">Symbol</label>
          <input
            className="w-full rounded-lg bg-neutral-800 px-3 py-2"
            value={symbol}
            onChange={onChangeSymbol}
            spellCheck={false}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs opacity-70">Amount</label>
          <input
            className="w-full rounded-lg bg-neutral-800 px-3 py-2"
            type="number"
            min={1}
            step={1}
            value={amt}
            onChange={onChangeAmt}
          />
        </div>
        <div className="col-span-3 flex items-end gap-2">
          <button
            className="rounded-lg px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50"
            onClick={p.onStart}
            disabled={p.running}
          >
            Start
          </button>
          <button
            className="rounded-lg px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
            onClick={p.onStop}
            disabled={!p.running}
          >
            Stop
          </button>
          <span className="text-xs opacity-60 ml-auto">
            Updated: {p.updatedAt.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="rounded-md px-3 py-2 bg-neutral-800 disabled:opacity-50"
          disabled={!p.running || !!p.disabledQuick}
          onClick={() => p.onQuickBuy(symbol, amt)}
        >
          Quick BUY {symbol}
        </button>
        <button
          className="rounded-md px-3 py-2 bg-neutral-800 disabled:opacity-50"
          disabled={!p.running || !!p.disabledQuick}
          onClick={() => p.onQuickSell(symbol, amt)}
        >
          Quick SELL {symbol}
        </button>
      </div>
    </div>
  );
}
