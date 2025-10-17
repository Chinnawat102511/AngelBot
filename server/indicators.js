// server/indicators.js — SAFE & FLEXIBLE
import {
  EMA, RSI, MACD, Stochastic, BollingerBands, ATR, OBV, IchimokuCloud
} from 'technicalindicators';

/**
 * series: { open[], high[], low[], close[], volume[], timeframe: '1m' }
 * cfg: indicator config
 * return: { dir: 'CALL'|'PUT'|'HOLD', reasons: string[], score: number }
 */
export function decideSignal(series, cfg = {}) {
  const c = withDefaults(cfg);
  const { open = [], high = [], low = [], close = [], volume = [] } = series || {};
  const n = close.length || 0;
  if (n < 60) return hold('warmup');

  // ถ้า minScore <= 0 หรือทุก indicator ปิดอยู่ → อนุญาตให้ยิงไม้แบบ “สุ่ม” (ไว้ทดสอบ)
  const everyDisabled =
    !c.ma.enable && !c.macd.enable && !c.rsi.enable && !c.stoch.enable &&
    !c.bb.enable && !c.atr.enable && !c.obv.enable && !c.ichi.enable;

  if (c.minScore <= 0 || everyDisabled) {
    return Math.random() < 0.5
      ? { dir: 'CALL', reasons: ['forced (minScore<=0 or all disabled)'], score: 0 }
      : { dir: 'PUT',  reasons: ['forced (minScore<=0 or all disabled)'], score: 0 };
  }

  const reasons = [];
  let longScore = 0, shortScore = 0;

  // ===== EMA (trend)
  let emaFast = null;
  if (c.ma.enable) {
    try {
      const emaArr = EMA.calculate({ period: number(c.ma.length, 50), values: close });
      emaFast = last(emaArr);
      if (emaFast != null) {
        if (close[n - 1] > emaFast) { longScore += 1; reasons.push('EMA up'); }
        if (close[n - 1] < emaFast) { shortScore += 1; reasons.push('EMA down'); }
      }
    } catch {}
  }

  // ===== MACD
  if (c.macd.enable) {
    try {
      const macdArr = MACD.calculate({
        fastPeriod: number(c.macd.fast, 12),
        slowPeriod: number(c.macd.slow, 26),
        signalPeriod: number(c.macd.signal, 9),
        SimpleMAOscillator: false,
        SimpleMASignal: false,
        values: close
      });
      const macd = last(macdArr);
      if (macd) {
        if (macd.MACD > macd.signal) { longScore += 1; reasons.push('MACD>signal'); }
        if (macd.MACD < macd.signal) { shortScore += 1; reasons.push('MACD<signal'); }
      }
    } catch {}
  }

  // ===== RSI
  if (c.rsi.enable) {
    try {
      const rsiArr = RSI.calculate({ period: number(c.rsi.length, 14), values: close });
      const rsi = last(rsiArr);
      if (rsi != null) {
        if (rsi <= number(c.rsi.os, 30)) { longScore += 1; reasons.push(`RSI<=${number(c.rsi.os,30)}`); }
        if (rsi >= number(c.rsi.ob, 70)) { shortScore += 1; reasons.push(`RSI>=${number(c.rsi.ob,70)}`); }
      }
    } catch {}
  }

  // ===== Stochastic
  if (c.stoch.enable) {
    try {
      const stArr = Stochastic.calculate({
        high, low, close,
        period: number(c.stoch.k, 14),
        signalPeriod: number(c.stoch.d, 3),
        smooth: number(c.stoch.smooth, 3),
      });
      const st = last(stArr);
      if (st && st.k != null && st.d != null) {
        if (st.k < number(c.stoch.os, 20) && st.d < number(c.stoch.os, 20) && st.k > st.d) {
          longScore += 1; reasons.push('Stoch up @OS');
        }
        if (st.k > number(c.stoch.ob, 80) && st.d > number(c.stoch.ob, 80) && st.k < st.d) {
          shortScore += 1; reasons.push('Stoch down @OB');
        }
      }
    } catch {}
  }

  // ===== Bollinger Bands
  if (c.bb.enable) {
    try {
      const bbArr = BollingerBands.calculate({
        period: number(c.bb.length, 20),
        values: close,
        stdDev: number(c.bb.k, 2)
      });
      const bb = last(bbArr);
      const price = close[n - 1];
      if (bb && bb.lower != null && bb.upper != null && isFinite(price)) {
        if (price <= bb.lower) { longScore += 1; reasons.push('BB lower touch'); }
        if (price >= bb.upper) { shortScore += 1; reasons.push('BB upper touch'); }
      }
    } catch {}
  }

  // ===== ATR (filter)
  if (c.atr.enable) {
    try {
      const atrArr = ATR.calculate({ high, low, close, period: number(c.atr.length, 14) });
      const atr = last(atrArr);
      if (atr != null && atr < number(c.atr.min, 1.5)) {
        return hold('ATR too low');
      }
    } catch {}
  }

  // ===== OBV (confirm)
  if (c.obv.enable) {
    try {
      const obvArr = OBV.calculate({ close, volume });
      const obv = last(obvArr);
      const obvPrev = obvArr.length > 1 ? obvArr[obvArr.length - 2] : obv;
      if (obv != null && obvPrev != null) {
        if (obv > obvPrev) { longScore += 0.5; reasons.push('OBV rising'); }
        if (obv < obvPrev) { shortScore += 0.5; reasons.push('OBV falling'); }
      }
    } catch {}
  }

  // ===== Ichimoku (trend)
  if (c.ichi.enable) {
    try {
      const ichiArr = IchimokuCloud.calculate({
        high, low,
        conversionPeriod: number(c.ichi.tenkan, 9),
        basePeriod: number(c.ichi.kijun, 26),
        spanPeriod: number(c.ichi.senkouB, 52),
        displacement: 0
      });
      const ichi = last(ichiArr);
      if (ichi) {
        const price = close[n - 1];
        const spanTop = Math.max(ichi.spanA, ichi.spanB);
        const spanBot = Math.min(ichi.spanA, ichi.spanB);
        if (price > spanTop) { longScore += 0.5; reasons.push('Above cloud'); }
        if (price < spanBot) { shortScore += 0.5; reasons.push('Below cloud'); }
      }
    } catch {}
  }

  const score = longScore - shortScore;
  if (score >= c.minScore)  return { dir: 'CALL', reasons, score };
  if (score <= -c.minScore) return { dir: 'PUT',  reasons, score };
  return hold('no-confluence');

  function hold(msg){ return { dir:'HOLD', reasons:[msg], score:0 }; }
  function last(a){ return (a && a.length) ? a[a.length-1] : null; }
  function number(v, d){ const x = Number(v); return Number.isFinite(x) ? x : d; }
}

function withDefaults(user) {
  return {
    minScore: 2,
    ma:   { enable: true,  type: 'EMA', length: 50, ...(user?.ma||{}) },
    macd: { enable: true,  fast: 12, slow: 26, signal: 9, ...(user?.macd||{}) },
    rsi:  { enable: true,  length: 14, ob: 70, os: 30, ...(user?.rsi||{}) },
    stoch:{ enable: true,  k: 14, d: 3, smooth: 3, ob: 80, os: 20, ...(user?.stoch||{}) },
    bb:   { enable: true,  length: 20, k: 2, ...(user?.bb||{}) },
    atr:  { enable: true,  length: 14, min: 1.5, ...(user?.atr||{}) },
    obv:  { enable: true,  ...(user?.obv||{}) },
    ichi: { enable: false, tenkan: 9, kijun: 26, senkouB: 52, ...(user?.ichi||{}) },
    ...(user||{})
  };
}
