import React from "react";

export type AutoAction = "start-pause" | "resume-pause";

export interface AutoStrategyConfig {
  enabled: boolean;
  name: string;        // ชื่อกลยุทธ์ (แค่ label)
  window: number;      // ใช้ n ไม้ล่าสุดในการคำนวณ
  minWinRate: number;  // % ชนะขั้นต่ำเพื่อให้ “Go”
  action: AutoAction;
}

type Props = {
  cfg: AutoStrategyConfig;
  onChange: (next: AutoStrategyConfig) => void;
  lastDecision?: string;
  lastAction?: string;
};

export default function AutoStrategyPanel({ cfg, onChange, lastDecision, lastAction }: Props) {
  return (
    <div className="rounded-lg bg-white shadow p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">Strategy Sandbox (paper)</div>
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => onChange({ ...cfg, enabled: e.target.checked })}
          />
          Enabled
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        <div>
          <label className="text-xs">Strategy</label>
          <select
            className="w-full input"
            value={cfg.name}
            onChange={(e) => onChange({ ...cfg, name: e.target.value })}
          >
            <option value="followTrend">Baseline (50/50)</option>
            <option value="meanRevert">Mean Revert</option>
          </select>
        </div>
        <div>
          <label className="text-xs">Test Amount ($)</label>
          <input className="w-full input" type="number" disabled value={10} />
        </div>
        <div>
          <label className="text-xs">MG Step (paper)</label>
          <input className="w-full input" type="number" disabled value={0} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        <div>
          <label className="text-xs">Window (trades)</label>
          <input
            className="w-full input"
            type="number"
            min={5}
            value={cfg.window}
            onChange={(e) => onChange({ ...cfg, window: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-xs">Min Winrate (%)</label>
          <input
            className="w-full input"
            type="number"
            min={0}
            max={100}
            value={cfg.minWinRate}
            onChange={(e) => onChange({ ...cfg, minWinRate: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-xs">Action</label>
          <select
            className="w-full input"
            value={cfg.action}
            onChange={(e) => onChange({ ...cfg, action: e.target.value as AutoAction })}
          >
            <option value="start-pause">Start ↔ Pause</option>
            <option value="resume-pause">Resume ↔ Pause</option>
          </select>
        </div>
        <div>
          <label className="text-xs">Status</label>
          <div className="w-full input bg-slate-50">{lastAction ?? "-"}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <div className="text-xs opacity-60">Last decision</div>
          <div className="text-base font-medium">{lastDecision ?? "-"}</div>
        </div>
        <div>
          <div className="text-xs opacity-60">Note</div>
          <div className="text-xs opacity-70">*paper sim ไม่ส่งคำสั่งซื้อขายจริง</div>
        </div>
      </div>
    </div>
  );
}
