// src/pages/index.tsx  (PATCH CORE ONLY — เพิ่ม useEffect SSE)
import { useEffect, useMemo, useRef, useState } from 'react'
import { getTrades, openTradesSSE, pauseBot, resumeBot, resetData, startBot, getState } from '../api'

type Trade = {
  id: string
  timestamp: string
  asset: string
  direction: 'CALL' | 'PUT'
  amount: number
  mg_step: number
  result: 'WIN' | 'LOSE' | 'EQUAL' | 'PENDING'
  profit: number
  strategy: string
  duration: 1 | 5
}

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [paused, setPaused] = useState(false)
  const [equity, setEquity] = useState(0)

  useEffect(() => {
    // initial load
    Promise.all([getTrades(200), getState()]).then(([t, s]) => {
      setTrades(t)
      setPaused(s.engine?.paused ?? false)
      setEquity(s.equity ?? 0)
    })

    // SSE subscribe
    const es = openTradesSSE()
    es.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'NEW') {
        setTrades(prev => [msg.payload, ...prev])
      } else if (msg.type === 'UPDATE') {
        setTrades(prev => {
          const i = prev.findIndex(x => x.id === msg.payload.id)
          if (i === -1) return prev
          const next = prev.slice()
          next[i] = msg.payload
          return next
        })
      } else if (msg.type === 'ENGINE_STATUS') {
        if (typeof msg.payload?.paused === 'boolean') setPaused(msg.payload.paused)
      } else if (msg.type === 'RESET') {
        setTrades([])
      }
    }
    es.onerror = () => { /* auto-reconnect is handled by EventSource */ }
    return () => es.close()
  }, [])

  const onPauseResume = async () => {
    if (paused) { await resumeBot(); setPaused(false) } else { await pauseBot(); setPaused(true) }
  }
  const onReset = async () => { await resetData(); setTrades([]) }

  const onStart = async () => {
    await startBot({
      seed: 777,
      amount_mode: 'percent',
      amount_percent: 1.5,
      daily_stop_loss: -200,
      daily_take_profit: 400,
      max_concurrent_pending: 1,
      mg_steps: 2,
      mg_multiplier: 2.0,
      mg_cap: 2,
      asset_cycle: ['XAUUSD','EURUSD'],
      duration: 1,
      strategy: 'Baseline',
      interval_ms: 60_000,
      equity_base: 1000
    })
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded bg-gray-200" onClick={onStart}>Start</button>
        <button className="px-3 py-2 rounded bg-gray-200" onClick={onPauseResume}>{paused ? 'Resume' : 'Pause'}</button>
        <button className="px-3 py-2 rounded bg-red-200" onClick={onReset}>Reset data</button>
        <div className="ml-auto text-sm opacity-70">Equity: {equity}</div>
      </div>

      <ul className="divide-y">
        {trades.map(t => (
          <li key={t.id} className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-60">{new Date(t.timestamp).toLocaleTimeString()}</span>
              <span className="font-mono">{t.asset}</span>
              <span className={t.direction === 'CALL' ? 'text-green-600' : 'text-red-600'}>{t.direction}</span>
              <span className="text-xs">MG{t.mg_step}</span>
              <span className="text-xs">{t.strategy}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${t.result==='WIN'?'text-green-700':t.result==='LOSE'?'text-red-700':'text-gray-600'}`}>{t.result}</span>
              <span className="font-mono">{t.profit}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
