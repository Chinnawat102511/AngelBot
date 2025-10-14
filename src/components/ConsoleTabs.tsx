import { useState } from 'react';
import type { Trade } from '../types';

type Props = {
  logLines: string[];
  trades: Trade[];
  onClearTrades?: () => void | Promise<void>;
  busyClear?: boolean;
};

export default function ConsoleTabs({ logLines, trades, onClearTrades, busyClear }: Props) {
  const [tab, setTab] = useState<'log' | 'trade'>('log');

  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4">
      <div className="flex items-center gap-2">
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded ${tab === 'log' ? 'bg-neutral-700' : 'bg-neutral-800'}`}
            onClick={() => setTab('log')}
          >
            Log Console
          </button>
          <button
            className={`px-3 py-1 rounded ${tab === 'trade' ? 'bg-neutral-700' : 'bg-neutral-800'}`}
            onClick={() => setTab('trade')}
          >
            Trade History ({trades.length})
          </button>
        </div>
        <div className="ml-auto">
          {tab === 'trade' && (
            <button
              className="px-3 py-1 rounded bg-neutral-800 disabled:opacity-50"
              onClick={onClearTrades}
              disabled={busyClear}
            >
              Reset / Clear
            </button>
          )}
        </div>
      </div>

      {tab === 'log' ? (
        <pre className="mt-3 bg-black/70 rounded-xl p-3 overflow-auto h-64">{logLines.join('\n')}</pre>
      ) : (
        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-800/70">
              <tr>
                <th className="text-left px-3 py-2">Timestamp</th>
                <th className="text-left px-3 py-2">Asset</th>
                <th className="text-left px-3 py-2">Direction</th>
                <th className="text-left px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">MG Step</th>
                <th className="text-left px-3 py-2">Result</th>
                <th className="text-left px-3 py-2">Profit</th>
                <th className="text-left px-3 py-2">Strategy</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={`${t.asset}-${t.ts}-${i}`} className="border-b border-neutral-800">
                  <td className="px-3 py-2">{new Date(t.ts).toLocaleString()}</td>
                  <td className="px-3 py-2">{t.asset}</td>
                  <td className="px-3 py-2">{t.side}</td>
                  <td className="px-3 py-2">${t.amount.toFixed(2)}</td>
                  <td className="px-3 py-2">{t.mgStep ?? '-'}</td>
                  <td className="px-3 py-2">{t.result}</td>
                  <td className={`px-3 py-2 ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.pnl.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">{t.strategy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
