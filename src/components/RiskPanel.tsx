import type { Risk } from '../types';

type Props = Risk & {
  onChange: (v: Partial<Risk>) => void;
};

export default function RiskPanel({ dailyTP, dailySL, maxOrders, onChange }: Props) {
  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4 space-y-2">
      <div className="font-semibold">Risk</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs opacity-70">Daily TP ($)</label>
          <input
            className="w-full rounded-lg bg-neutral-800 px-3 py-2"
            type="number"
            value={dailyTP}
            onChange={(e) => onChange({ dailyTP: Number(e.target.value || 0) })}
          />
        </div>
        <div>
          <label className="text-xs opacity-70">Daily SL ($)</label>
          <input
            className="w-full rounded-lg bg-neutral-800 px-3 py-2"
            type="number"
            value={dailySL}
            onChange={(e) => onChange({ dailySL: Number(e.target.value || 0) })}
          />
        </div>
        <div>
          <label className="text-xs opacity-70">Max Orders</label>
          <input
            className="w-full rounded-lg bg-neutral-800 px-3 py-2"
            type="number"
            value={maxOrders ?? 0}
            onChange={(e) => onChange({ maxOrders: Number(e.target.value || 0) })}
          />
        </div>
      </div>
    </div>
  );
}
