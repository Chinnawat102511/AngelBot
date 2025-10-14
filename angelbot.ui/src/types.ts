// src/types.ts

export type TradeResult = 'WIN' | 'LOSE' | 'DRAW';

export interface Trade {
  id: number;
  ts: number;              // epoch ms
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  reqPrice: number;
  fillPrice: number;
  pnl: number;
  mgStep?: number;
  result?: TradeResult;
  strategy?: string;
}

export interface EngineStats {
  orders: number;
  win: number;
  lose: number;
  draw: number;
  session_pnl: number;
}

export interface EngineStatus {
  running: boolean;
  connected: boolean;
  balance: number;
  account_type: string;
  stats: EngineStats;

  // helper สำหรับ UI
  tradesCount?: number;
  lastTrade?: Trade | null;

  // 👇 เพิ่ม optional fields ที่หน้าจออ้างถึง
  session_started_at?: number;   // epoch ms (ถ้า backend จะส่ง)
  max_mg_step?: number;          // ขั้นสูงสุดของ MG (ถ้ามี)
}