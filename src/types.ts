// Timeframe
export type TF = "1m" | "5m";

/** โหมดตัวกรองเทรนด์ (ให้ gates.ts import ได้) */
export type TrendFilter = "STRICT" | "WEAK" | "OFF";

/** การตั้งค่ากลยุทธ์ */
export type StrategyConfig = {
  name: string;
  signalStrength?: number;

  ma?: {
    enabled?: boolean;
    type?: "EMA" | "SMA" | "WMA" | "HMA";
    length?: number;
    bias?: "NONE" | "UP" | "DOWN";
  };

  macd?: {
    enabled?: boolean;
    fast?: number;
    slow?: number;
    signal?: number;
    mode?: "CROSS" | "TREND";
  };

  rsi?: {
    enabled?: boolean;
    length?: number;
    ob?: number;
    os?: number;
    mode?: "OBOS" | "DIVERGENCE";
  };

  // เพิ่มส่วนอื่น ๆ ภายหลังได้
  ai?: { conf: number; gap: number };
  mbf?: { conf: number; gap: number };
};

/** การตั้งค่าไม้ทบ (Martingale) */
export type MgConfig = {
  mode: "FIXED" | "MULTIPLIER" | "CUSTOM";
  base: number;
  mult: number;
  steps: number;
  customList: number[];        // ใช้เมื่อ mode = "CUSTOM"
  scope: "COMBINED" | "SEPARATE";
  stepByPairOnly: boolean;
};

/** ฟิลเตอร์ก่อนส่งคำสั่ง */
export type Filters = {
  leadTimeSec: number;         // ยิงก่อนนาทีใหม่ภายในกี่วินาที
  trendFilter: TrendFilter;    // ใช้ type ที่ export ไว้ด้านบน
  micro5m: boolean;
  timeWindows: string[];       // รูปแบบ "HH:mm-HH:mm"
};

/** การจำกัดความเสี่ยงรายวัน */
export type Risk = {
  dailyTP: number;             // กำไรสูงสุดต่อวัน
  dailySL: number;             // ขาดทุนสูงสุดต่อวัน
  maxOrders?: number;          // จำนวนออเดอร์สูงสุดต่อวัน (ถ้ามี)
};

/** บันทึกผลเทรดเดี่ยว */
export type Trade = {
  ts: number;                  // unix ms
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

/** สถานะที่ต้อง persist */
export type Persisted = {
  tf: TF;
  assets: string[];
  mg: MgConfig;
  strategy1m: StrategyConfig;
  strategy5m: StrategyConfig;
  filters: Filters;
  risk: Risk;
  orderIntervalSec: number;
  scheduler?: {
    enabled: boolean;
    start: string;             // "HH:mm"
    stop: string;              // "HH:mm"
    workdays: boolean[];       // ยาว 7 ช่องอาจใช้ [อา..ส]
    skipWeekend: boolean;
    resetTime: string;         // "HH:mm"
  };
};
