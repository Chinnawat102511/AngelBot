// server/mg/engine.js (ESM)
let cfg = {
  baseStake: 1.0,
  multiplier: 2.0,
  maxStep: 3,
  maxStake: 50,
  cooldownSec: 0,
  payout: 0.82,
};

let state = {
  step: 0,
  prevStake: 0,
  lastAt: 0,
};

export function getConfig() { return cfg; }
export function setConfig(p) { cfg = { ...cfg, ...(p ?? {}) }; return cfg; }

export function resetMG() {
  state = { step: 0, prevStake: 0, lastAt: 0 };
  return state;
}

function ceil2(x) { return Math.ceil(x * 100) / 100; }

export function nextMG({ lastResult = null, lastPnl = 0 } = {}) {
  const now = Date.now();
  if (cfg.cooldownSec > 0 && state.lastAt > 0) {
    const remain = cfg.cooldownSec - (now - state.lastAt) / 1000;
    if (remain > 0) {
      return { ok: false, halt: true, reason: "cooldown", remainSec: Math.ceil(remain), step: state.step };
    }
  }

  let step = state.step;
  let stake;

  if (lastResult === "WIN") {
    step = 0;
    stake = cfg.baseStake;
  } else if (lastResult === "LOSS") {
    step = step + 1;
    if (step > cfg.maxStep) {
      state.lastAt = now;
      state.step = step; // keep for info
      return { ok: false, halt: true, reason: "maxStep", step };
    }
    // สูตรพื้นฐาน: ทบตาม multiplier จากสเต็กก่อนหน้า (ถ้าไม่มีใช้ base)
    const base = state.prevStake > 0 ? state.prevStake : cfg.baseStake;
    stake = ceil2(base * cfg.multiplier);
  } else {
    // first call / ไม่รู้ผลก่อนหน้า -> เริ่ม base
    step = 0;
    stake = cfg.baseStake;
  }

  // guard: maxStake
  if (stake > cfg.maxStake) {
    stake = cfg.maxStake;
    // ถ้าเกิน maxStake ที่ยังชดเชยไม่ได้ ให้แจ้งเหตุผลด้วย
    // แต่ไม่ halt เพื่อให้ผู้ใช้ตัดสินใจเอง
    const info = { ok: true, step, stake, reason: "cap:maxStake" };
    state.step = step;
    state.prevStake = stake;
    state.lastAt = now;
    return info;
  }

  const info = { ok: true, step, stake };
  state.step = step;
  state.prevStake = stake;
  state.lastAt = now;
  return info;
}
