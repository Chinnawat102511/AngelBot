// angelbot-engine/lib/tradeEngine.js  (CommonJS)

class TradeEngine {
  constructor(logger) {
    this.logger = logger;
    this.isRunning = false;
    this._timer = null;
    this._intervalMs = 2000;
    this._trades = [];          // เก็บประวัติ trade
    this.autoTrader = null;     // optional
  }

  setAutoTrader(autoTrader) {
    this.autoTrader = autoTrader;
    this.logger?.info?.('🔗 AutoTrader attached to TradeEngine');
  }

  start(intervalMs = 2000) {
    if (this.isRunning) return { started: false, reason: 'already-running' };
    this.isRunning = true;
    this._intervalMs = Number(intervalMs) || 2000;

    // loop เบา ๆ (เอาไว้ future hook เช่น sync, flush, heartbeat)
    this._timer = setInterval(async () => {
      try {
        // ใส่ logic background ที่ต้องการได้
      } catch (err) {
        this.logger?.error?.('engine loop error:', err?.message || err);
      }
    }, this._intervalMs);

    this.logger?.info?.(`🚀 Engine started (interval ${this._intervalMs}ms)`);
    return { started: true, intervalMs: this._intervalMs };
  }

  stop() {
    if (!this.isRunning) return { stopped: false, reason: 'not-running' };
    this.isRunning = false;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this.logger?.info?.('🛑 Engine stopped');
    return { stopped: true };
  }

  status() {
    return {
      running: this.isRunning,
      intervalMs: this._intervalMs,
      trades: this._trades.length,
    };
  }

  listTrades(limit = 50) {
    return this._trades.slice(-Number(limit || 50)).reverse();
  }

  // รับสัญญาณจาก /engine/signal
  executeSignal({ symbol, side, qty, price, owner, note }) {
    if (!this.isRunning) {
      return { ok: false, error: 'engine-not-running' };
    }
    const now = new Date().toISOString();
    const trade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: now,
      symbol: String(symbol).toUpperCase(),
      side,                            // 'BUY' | 'SELL'
      qty: Number(qty),
      price: Number(price || 0),
      owner: owner || 'manual',
      note: note || null,
      source: 'signal',
    };
    this._trades.push(trade);
    this.logger?.info?.('📝 EXECUTE', JSON.stringify(trade));
    return { ok: true, trade };
  }
}

module.exports = { TradeEngine };
