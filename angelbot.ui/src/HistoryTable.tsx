import { useEffect, useRef, useState } from 'react'
import { useToast } from './providers/ToastProvider'

type Trade = {
  id: string
  timestamp: string
  asset: string
  direction: 'CALL' | 'PUT'
  amount: number
  mg_step: number
  // เพิ่ม PENDING เข้ามาให้ตรงกับฝั่ง server
  result: 'WIN' | 'LOSE' | 'EQUAL' | 'PENDING'
  profit: number
  strategy: string
  duration: 1 | 5
}
type Json = any

async function api<T = Json>(
  input: RequestInfo,
  init?: RequestInit & { expectJson?: boolean }
): Promise<T> {
  const r = await fetch(input, init)
  if (!r.ok) {
    let msg = `${init?.method || 'GET'} ${typeof input === 'string' ? input : ''} ${r.status}`
    try {
      const j = await r.json()
      if (j?.message) msg = j.message
    } catch {}
    throw new Error(msg)
  }
  if (init?.expectJson === false) return undefined as unknown as T
  try {
    return (await r.json()) as T
  } catch {
    return {} as T
  }
}

export default function HistoryTable() {
  const { error, info, success } = useToast()

  const [trades, setTrades] = useState<Trade[]>([])
  const [limit, setLimit] = useState(200)
  const [loading, setLoading] = useState(false) // manual refresh
  const [auto, setAuto] = useState(true) // ออโต้รีเฟรช
  const [running, setRunning] = useState(false) // สถานะบอท

  const pollMs = 2000
  const timerRef = useRef<any>(null)

  const loadStatus = async () => {
    const s = await api<Json>('/api/status', { cache: 'no-store' })
    setRunning(Boolean(s?.is_bot_running))
  }

  const loadTrades = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const d = await api<{ trades: Trade[] }>(`/api/trades?limit=${limit}`, { cache: 'no-store' })
      setTrades(d?.trades ?? [])
    } catch (e: any) {
      error(e?.message || 'Load trades failed')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      await Promise.all([loadStatus(), loadTrades(true)]) // เงียบ ๆ ตอนแรก
    })()
  }, [limit])

  useEffect(() => {
    // ออโต้รีเฟรชเฉพาะตอนเปิด auto และบอทกำลังรัน
    if (!auto || !running) return
    timerRef.current = setInterval(() => loadTrades(true), pollMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [auto, running])

  const refresh = async () => {
    await Promise.all([loadStatus(), loadTrades(false)])
    info('Trades refreshed')
  }

  const exportCsv = async () => {
    try {
      const r = await fetch('/api/trades/export', { method: 'POST' })
      if (!r.ok) throw new Error(`export ${r.status}`)
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // ชื่อไฟล์จาก header ถ้ามี ไม่งั้นตั้งเอง
      const cd = r.headers.get('Content-Disposition') || ''
      const m = /filename="?([^"]+)"?/i.exec(cd)
      a.download = m?.[1] || `trades_${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      success('Exported ✓')
    } catch (e: any) {
      error(e?.message || 'Export failed')
    }
  }

  // Badge แสดงผลลัพธ์ (เพิ่ม PENDING)
  const resultBadge = (t: Trade) => {
    const base = 'inline-flex items-center gap-1 rounded px-2 py-[2px] text-[11px] font-semibold'
    if (t.result === 'WIN')
      return <span className={`${base} bg-emerald-100 text-emerald-700`}>WIN</span>
    if (t.result === 'LOSE')
      return <span className={`${base} bg-rose-100 text-rose-700`}>LOSE</span>
    if (t.result === 'PENDING')
      return (
        <span className={`${base} bg-amber-100 text-amber-700`}>
          <span className="h-[6px] w-[6px] rounded-full bg-amber-600 animate-pulse" />
          PENDING
        </span>
      )
    return <span className={`${base} bg-gray-100 text-gray-700`}>EQUAL</span>
  }

  const profitClass = (p: number) =>
    p > 0 ? 'text-emerald-600' : p < 0 ? 'text-rose-600' : 'text-gray-600'

  const formatTime = (iso: string) => new Date(iso).toLocaleString()

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-gray-500">
          Latest {trades.length} of {limit} (auto: {auto ? 'on' : 'off'} • running: {String(running)})
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
            Auto-refresh while running
          </label>
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[50, 100, 200, 500, 1000].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md bg-gray-600 px-3 py-2 text-white disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={exportCsv}
            className="rounded-md bg-indigo-600 px-3 py-2 text-white"
            title="Export recent trades to CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded border">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Asset</th>
              <th className="px-3 py-2 text-left">Dir</th>
              <th className="px-3 py-2 text-right">Amt</th>
              <th className="px-3 py-2 text-center">Result</th>
              <th className="px-3 py-2 text-right">Profit</th>
              <th className="px-3 py-2 text-left">Strat</th>
              <th className="px-3 py-2 text-center">TF</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  No records.
                </td>
              </tr>
            )}
            {trades.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2">{formatTime(t.timestamp)}</td>
                <td className="px-3 py-2">{t.asset}</td>
                <td className="px-3 py-2">{t.direction}</td>
                <td className="px-3 py-2 text-right">{t.amount.toFixed(2)}</td>
                <td className="px-3 py-2 text-center">{resultBadge(t)}</td>
                <td className={`px-3 py-2 text-right ${t.result === 'PENDING' ? 'text-gray-400' : profitClass(t.profit)}`}>
                  {t.result === 'PENDING' ? '…' : t.profit.toFixed(2)}
                </td>
                <td className="px-3 py-2">{t.strategy}</td>
                <td className="px-3 py-2 text-center">{t.duration}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
