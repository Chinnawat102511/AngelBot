// angelbot-engine/lib/autoTrader.js
// CommonJS module

class AutoTrader {
  constructor(engine, logger, cfg = {}) {
    this.engine = engine;     // ต้องเป็น TradeEngine
    this.logger = logger;
    this._timer = null;
    this._state = { emaFast: null, emaSlow: null, lastPrice: null };
    this._cfg = {};

    // ค่าเริ่มต้น
    this.setConfig(cfg);

    // ผูกตัวเองเข้ากับ engine ถ้ามีเมธอด
    if (this.engine?.setAutoTrader) this.engine.setAutoTrader(this);
  }

  // ---------- Config / State ----------
  setConfig(cfg = {}) {
    const merged = {
      symbol:     cfg.symbol ?? 'EURUSD',
      tf:         cfg.tf ?? '1m',
      qty:        toPosNumber(cfg.qty, 1),
      intervalMs: clamp(toPosNumber(cfg.intervalMs, 2000), 250, 60_000),
      emaFast:    clamp(toPosNumber(cfg.emaFast, 12), 2, 500),
      emaSlow:    clamp(toPosNumber(cfg.emaSlow, 26), 3, 600),
      basePrice:  toPosNumber(cfg.basePrice, 1.10000),
      vol:        toPosNumber(cfg.vol, 0.0010),    // max เปลี่ยนต่อ tick
      owner:      cfg.owner ?? 'autotrader',
      meanRev:    clamp(Number.isFinite(cfg.meanRev) ? Number(cfg.meanRev) : 0.05, 0, 1),
      // hysteresis ป้องกันสัญญาณแกว่ง (เช่น 0.0005 = 0.05%)
      hysteresis: Math.max(0, Number(cfg.hysteresis ?? 0.0005)),
    };

    if (merged.emaSlow <= merged.emaFast) {
      merged.emaSlow = merged.emaFast + 1;
    }

    this._cfg = merged;
    return this.getConfig();
  }

  updateConfig(partial = {}) {
    const wasRunning = this.running();
    const prevInterval = this._cfg.intervalMs;

    this.setConfig({ ...this._cfg, ...partial });

    if (wasRunning && this._cfg.intervalMs !== prevInterval) {
      // รีสตาร์ท timer เพื่อใช้ interval ใหม่
      this._restartTimer();
    }
    this._info('⚙️ AutoTrader config updated:', toJSON(this._cfg));
    return this.getConfig();
  }

  getConfig() { return { ...this._cfg }; }

  getState() {
    const { lastPrice, emaFast, emaSlow } = this._state;
    return { lastPrice, emaFast, emaSlow };
  }

  status() {
    return {
      running: this.running(),
      cfg: this.getConfig(),
      state: this.getState(),
    };
  }

  // ---------- Control ----------
  running() { return !!this._timer; }

  start() {
    if (this.running()) return { ok: false, error: 'already-running' };
    if (!this.engine?.isRunning) return { ok: false, error: 'engine-not-running' };

    // reset state
    this._state = { emaFast: null, emaSlow: null, lastPrice: null };

    this._createTimer();
    this._info(`🤖 AutoTrader started (interval ${this._cfg.intervalMs}ms)`);
    return { ok: true, started: true, cfg: this.getConfig() };
  }

  stop() {
    if (!this.running()) return { ok: true, stopped: false, reason: 'not-running' };
    clearInterval(this._timer);
    this._timer = null;
    this._info('🛑 AutoTrader stopped');
    return { ok: true, stopped: true };
  }

  // ---------- Timer helpers ----------
  _createTimer() {
    this._timer = setInterval(() => this._safeTick(), this._cfg.intervalMs);
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  _restartTimer() {
    if (this.running()) {
      clearInterval(this._timer);
      this._timer = null;
      this._createTimer();
      this._info(`⏱️ Timer restarted with interval ${this._cfg.intervalMs}ms`);
    }
  }

  // ---------- Core ----------
  _safeTick() {
    try { this._tick(); }
    catch (e) { this._warn('tick error:', e?.message || e); }
  }

  _tick() {
    if (!this.engine?.isRunning) return;

    // เดินราคาจำลอง: mean-reverting random walk
    const last = isFiniteNum(this._state.lastPrice) ? this._state.lastPrice : this._cfg.basePrice;
    const noise = (Math.random() - 0.5) * this._cfg.vol;
    const pull  = (this._cfg.basePrice - last) * this._cfg.meanRev;
    const price = round5(last + noise + pull);

    // EMA
    const kFast = 2 / (this._cfg.emaFast + 1);
    const kSlow = 2 / (this._cfg.emaSlow + 1);

    const emaFast = (this._state.emaFast == null)
      ? price
      : (price - this._state.emaFast) * kFast + this._state.emaFast;

    const emaSlow = (this._state.emaSlow == null)
      ? price
      : (price - this._state.emaSlow) * kSlow + this._state.emaSlow;

    // สัญญาณด้วย hysteresis
    let side = null;
    if (this._state.emaFast != null && this._state.emaSlow != null) {
      const prevDiff = this._state.emaFast - this._state.emaSlow;
      const currDiff = emaFast - emaSlow;

      const th = this._cfg.hysteresis * Math.max(1, Math.abs(emaSlow)); // ค่ากั้น
      if (prevDiff <= 0 && currDiff >  th) side = 'BUY';
      else if (prevDiff >= 0 && currDiff < -th) side = 'SELL';
    }

    // commit state
    this._state.lastPrice = price;
    this._state.emaFast = emaFast;
    this._state.emaSlow = emaSlow;

    // สั่งเทรดเมื่อมีสัญญาณ
    if (side) {
      const payload = {
        symbol: this._cfg.symbol,
        side,                              // 'BUY' | 'SELL'
        qty: this._cfg.qty,
        tf: this._cfg.tf,
        owner: this._cfg.owner,
        price,                             // ใช้ฟิลด์ price ให้ตรงกับ engine.executeSignal
        note: `emaFast=${emaFast.toFixed(5)}, emaSlow=${emaSlow.toFixed(5)}`,
      };

      try {
        const r = this.engine.executeSignal(payload);
        if (!r?.ok) this._warn('order rejected:', toJSON(r));
        else this._info('✅ AutoTrader trade:', toJSON(r.trade));
      } catch (e) {
        this._error('engine error:', e?.message || e);
      }
    } else {
      this._debug(`tick p=${price.toFixed(5)} ef=${emaFast.toFixed(5)} es=${emaSlow.toFixed(5)}`);
    }
  }

  // ---------- Logging helpers ----------
  _info(...a)  { if (this.logger?.info)  this.logger.info(...a);  else console.log(...a); }
  _warn(...a)  { if (this.logger?.warn)  this.logger.warn(...a);  else console.warn(...a); }
  _error(...a) { if (this.logger?.error) this.logger.error(...a); else console.error(...a); }
  _debug(...a) { if (this.logger?.debug) this.logger.debug(...a); else console.debug(...a); }
}

// ---------- utils ----------
function toPosNumber(v, defVal) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : defVal;
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function isFiniteNum(n)   { return Number.isFinite(n); }
function round5(x)        { return Number(x.toFixed(5)); }
function toJSON(obj)      { try { return JSON.stringify(obj); } catch { return String(obj); } }

module.exports = { AutoTrader };
