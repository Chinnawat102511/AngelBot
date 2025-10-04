// src/api.ts
import { TF } from "./types";

export type LicenseResp = { ok: boolean; message?: string };
export type StatusResp = {
  is_connected: boolean;
  is_bot_running: boolean;
  balance?: number;
  currency_code?: string;
  account_type?: "PRACTICE" | "REAL";
};

type ConnectResp = {
  message?: string;
  balance?: number;
  currency_code?: string;
  account_type?: "PRACTICE" | "REAL";
};

// ---- AI status model used in App.tsx ----
export type AiStatus = {
  model: string;
  version: string;
  lr: number;              // learning rate
  acc: number;             // 0..1
  winrate: number;         // 0..1
  ordersSinceRetrain: number;
  everyOrders: number;
  nextAutoOrders?: number;
  lastRetrainTs?: number;
};

// ---- Live indicator row used in Asset Live Board ----
export type LiveRow = {
  asset: string;
  ts: number;
  ok: boolean;
  price: number;
  maBias: "Up" | "Down" | "-";
};

// NOTE: ตรงนี้เป็น mock ให้รันได้ทันที ถ้าเชื่อม backend จริงให้แก้เรียก REST ตามสัญญา API
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
  async licenseCheck(licenseJson: string): Promise<LicenseResp> {
    await sleep(200);
    // แค่ตรวจว่าเป็น JSON ได้
    try {
      JSON.parse(licenseJson);
      return { ok: true, message: "License OK" };
    } catch {
      return { ok: false, message: "Invalid license JSON" };
    }
  },

  async status(): Promise<StatusResp> {
    await sleep(150);
    const bal = Number(localStorage.getItem("mock_balance") || "228077.38");
    return {
      is_connected: true,
      is_bot_running: false,
      balance: bal,
      currency_code: "THB",
      account_type: "PRACTICE",
    };
  },

  async connect(email: string, password: string, accountType: "PRACTICE" | "REAL"): Promise<ConnectResp> {
    await sleep(250);
    // mock success
    return {
      message: "Connected",
      balance: Number(localStorage.getItem("mock_balance") || "228077.38"),
      currency_code: accountType === "REAL" ? "USD" : "THB",
      account_type: accountType,
    };
  },

  // -------- Indicator / Live board --------
  async indicatorsLive(assets: string[], tf: TF, n: number): Promise<LiveRow[]> {
    await sleep(150);
    return (assets.length ? assets : ["EURUSD"]).slice(0, 8).map(a => ({
      asset: a,
      ts: Date.now(),
      ok: true,
      price: Math.random() * (a.includes("XAU") ? 2000 : 1.6) + (a.includes("XAU") ? 1700 : 0.7),
      maBias: Math.random() > 0.5 ? "Up" : "Down",
    }));
  },

  // -------- AI status / controls --------
  async aiStatus(tf: TF): Promise<AiStatus> {
    await sleep(180);
    const every = Number(localStorage.getItem("ai_every") || "40");
    return {
      model: `AI Model (${tf})`,
      version: "1.0.1",
      lr: 0.001,
      acc: 0.561,
      winrate: 0.525,
      ordersSinceRetrain: Math.floor(Math.random() * every),
      everyOrders: every,
      nextAutoOrders: Math.max(0, every - Math.floor(Math.random() * every)),
      lastRetrainTs: Date.now() - 86400_000 * Math.random(),
    };
  },

  async aiAuto(tf: TF, enabled: boolean, everyOrders: number): Promise<{ ok: boolean }> {
    await sleep(120);
    localStorage.setItem("ai_every", String(everyOrders || 40));
    return { ok: true };
  },

  async aiRetrain(tf: TF, reason: string): Promise<{ ok: boolean }> {
    await sleep(300);
    return { ok: true };
  },

  async aiCalibrate(tf: TF, method: "ECE" | "Platt" | "Temp", reason: string): Promise<{ ok: boolean }> {
    await sleep(300);
    return { ok: true };
  },
};
