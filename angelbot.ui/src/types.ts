// ==============================
// AngelBot UI — shared types
// ==============================
export type AccountType = "PRACTICE" | "REAL";

export interface BotConfig {
  orderDuration: string;      // ex. "1 Minute"
  amount: number;             // $ per order
  internalMs: number;         // poll/interval ms
  assetsCsv: string;          // "XAUUSD,EURUSD"
  strategy: string;           // ex. "Baseline"
  baseEquityInput: number;    // base equity (UI)
}

export type BotStatus = "running" | "paused" | "stopped";

export interface BotState {
  status: BotStatus;
  connected: boolean;
  accountType: AccountType;
  baseEquity: number;
  realizedPL: number;
  equityLive: number;
}

export type Direction = "CALL" | "PUT";
export type Result = "WIN" | "LOSE" | "EQUAL" | string;

export interface Trade {
  id: string;
  timestamp: string;          // ISO
  asset: string;
  direction: Direction;
  amount: number;
  mgStep: number;
  duration: string;           // "1m"
  result: Result;
  result_pl?: number;
  strategy: string;
}

export type GuardMode = "Percent" | "Value";

export interface RiskGuard {
  enabled: boolean;
  mode: GuardMode;
  value: number;              // % or $
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
