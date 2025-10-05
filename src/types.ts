// src/types.ts
export type TF = "1m" | "5m";

export type TrendFilter = "STRICT" | "WEAK" | "OFF";

export type StrategyConfig = {
  name: string;
  signalStrength?: number;
  ma?: { enabled?: boolean; type?: "SMA" | "EMA" | "WMA" | "HMA"; length?: number; bias?: "NONE" | "UP" | "DOWN" };
  macd?: { enabled?: boolean; fast?: number; slow?: number; signal?: number; mode?: "CROSS" | "TREND" };
  rsi?: { enabled?: boolean; length?: number; ob?: number; os?: number; mode?: "OBOS" | "DIVERGENCE" };
  ai?: { conf: number; gap: number };
  mbf?: { conf: number; gap: number };
};

export type MgConfig = {
  mode: "FIXED" | "MULTIPLIER" | "CUSTOM";
  base: number;
  mult: number;
  steps: number;
  customList: number[];
  scope: "COMBINED" | "SEPARATE";
  stepByPairOnly: boolean;
};

export type Filters = {
  leadTimeSec: number;
  trendFilter: TrendFilter;
  micro5m: boolean;
  timeWindows: string[];
};

export type Risk = { dailyTP: number; dailySL: number; maxOrders?: number };

export type Trade = {
  ts: number;
  asset: string;
  tf: TF;
  side: "CALL" | "PUT";
  amount: number;
  mgStep: number;
  result: "WIN" | "LOSE" | "DRAW";
  payout: number;
  pnl: number;
  strategy: string;
};

export type Persisted = {
  tf: TF;
  assets: string[];
  mg: MgConfig;
  strategy1m: StrategyConfig;
  strategy5m: StrategyConfig;
  filters: Filters;
  risk: Risk;
  orderIntervalSec: number;
  scheduler?: { enabled: boolean; start: string; stop: string; workdays: boolean[]; skipWeekend: boolean; resetTime: string };
};
