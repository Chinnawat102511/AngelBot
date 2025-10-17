// angelbot.ui/src/components/EquityChart.tsx
import { useEffect, useState } from 'react'

type EquityPoint = {
  // backend อาจส่งเป็น {t,v} หรือ {ts,balance,pnl}
  t?: string
  ts?: string
  v?: number
  balance?: number
  pnl?: number
}

export default function EquityChart() {
  const [points, setPoints] = useState<EquityPoint[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchEquity(limit = 200) {
    try {
      setLoading(true)
      const r = await fetch(`/api/equity?limit=${limit}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      setPoints(Array.isArray(j?.points) ? j.points : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEquity()
    const t = setInterval(() => fetchEquity(), 5_000) // ดึงทุก 5 วิ (พอๆ กับ auto-refresh)
    return () => clearInterval(t)
  }, [])

  // map ค่า balance ออกมาเป็นตัวเลขให้ได้เสมอ
  const values = points.map(p =>
    Number.isFinite(p.balance as number)
      ? (p.balance as number)
      : Number(p.v ?? 0)
  )

  const hasData = values.length > 0
  const min = hasData ? Math.min(...values) : 0
  const max = hasData ? Math.max(...values) : 0
  const range = Math.max(1e-9, max - min) // กันหารศูนย์

  // สร้าง path ของ sparkline แบบ responsive
  const w = Math.max(1, values.length - 1)
  const d = values
    .map((v, i) => {
      const x = (i / w) * 100
      const y = 100 - ((v - min) / range) * 100
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`
    })
    .join(' ')

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 text-xs text-gray-500">
        Balance: {(max ?? 0).toFixed(2)} · PnL: {(max - min).toFixed(2)} · Range: {(min ?? 0).toFixed(2)} – {(max ?? 0).toFixed(2)}
      </div>

      {!hasData ? (
        <div className="h-16 grid place-items-center text-xs text-gray-400">
          {loading ? 'Loading…' : 'No equity data yet'}
        </div>
      ) : (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full">
          <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </div>
  )
}
