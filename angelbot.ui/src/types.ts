// ====== Shared types used by UI/API ======
export type AccountType = "PRACTICE" | "REAL";

export type GuardMode = "Percent" | "Value";

export interface RiskGuard {
  enabled: boolean;
  mode: GuardMode;      // Percent | Value
  value: number;        // percent or money
}

export interface BotConfig {
  orderDuration: "1 Minute" | "3 Minutes" | "5 Minutes";
  amount: number;        // order size ($)
  internalMs: number;    // interval between decisions
  assetsCsv: string;     // selected symbols
  strategy: string;
  baseEquityInput: number;
}

export interface BotState {
  status: "running" | "paused" | "stopped";
  connected: boolean;
  accountType: AccountType;
  balance?: number;
}

export interface Trade {
  id: number;
  timestamp: number;             // ms epoch (normalized)
  asset: string;
  direction: "CALL" | "PUT";
  amount: number;
  mgStep: number;
  duration: string;              // e.g. "1m"
  result: "WIN" | "LOSE" | "EQUAL"; // normalized (DRAW -> EQUAL)
  result_pl: number;             // P/L of this trade
  strategy: string;
}

// Generic API response used by helpers
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error?: string };

// (สำหรับของเดิมที่อาจยังอ้างถึง)
export type LicenseStatus =
  | { ok: true; key: string; plan: string; expiresAt: string; remote: { enabled: boolean } }
  | { ok: false; key: string | null; reason: string; remote: { enabled: boolean } };
