import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../providers/ToastProvider'

type Json = any

// tiny fetch helper
async function api<T = Json>(input: RequestInfo, init?: RequestInit & { expectJson?: boolean }): Promise<T> {
  const r = await fetch(input, init)
  if (!r.ok) {
    let msg = `${init?.method || 'GET'} ${typeof input === 'string' ? input : ''} ${r.status}`
    try { const j = await r.json(); if (j?.message) msg = j.message } catch {}
    throw new Error(msg)
  }
  if (init?.expectJson === false) return undefined as unknown as T
  try { return (await r.json()) as T } catch { return {} as T }
}

function parseAssets(text: string): string[] {
  // รองรับคั่นด้วย comma หรือช่องว่างหลายตัว
  return text
    .split(/[, \n\r\t]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
}

export default function BotControlPanel() {
  const { success, error, info } = useToast()

  // ------------ form state (with localStorage persistence) ------------
  const [assetsText, setAssetsText] = useState<string>(() => localStorage.getItem('bc_assets') || 'EURUSD,XAUUSD')
  const [blockStart, setBlockStart]   = useState<string>(() => localStorage.getItem('bc_bstart') || '09:00')
  const [blockEnd, setBlockEnd]       = useState<string>(() => localStorage.getItem('bc_bend') || '16:30')
  const [duration, setDuration]       = useState<'1' | '5'>(() => (localStorage.getItem('bc_tf') as any) || '5')
  const [amount, setAmount]           = useState<string>(() => localStorage.getItem('bc_amt') || '1')
  const [lead, setLead]               = useState<string>(() => localStorage.getItem('bc_lead') || '5')
  const [strategy, setStrategy]       = useState<string>(() => localStorage.getItem('bc_strat') || 'Baseline')
  const [micro5m, setMicro5m]         = useState<boolean>(() => (localStorage.getItem('bc_micro5') === '1') || false)

  useEffect(() => { localStorage.setItem('bc_assets', assetsText) }, [assetsText])
  useEffect(() => { localStorage.setItem('bc_bstart', blockStart) }, [blockStart])
  useEffect(() => { localStorage.setItem('bc_bend', blockEnd) }, [blockEnd])
  useEffect(() => { localStorage.setItem('bc_tf', duration) }, [duration])
  useEffect(() => { localStorage.setItem('bc_amt', amount) }, [amount])
  useEffect(() => { localStorage.setItem('bc_lead', lead) }, [lead])
  useEffect(() => { localStorage.setItem('bc_strat', strategy) }, [strategy])
  useEffect(() => { localStorage.setItem('bc_micro5', micro5m ? '1' : '0') }, [micro5m])

  // ------------ live status ------------
  const [status, setStatus] = useState<Json>({ running: false, connected: false, balance: 0, account: 'PRACTICE', hud_step: 0 })
  const [lastPayload, setLastPayload] = useState<Json | null>(null)
  const [busyStart, setBusyStart] = useState(false)
  const [busyStop, setBusyStop] = useState(false)

  const pollMs = 1500
  const timerRef = useRef<any>(null)

  const engineApiBase = useMemo(() => 'http://localhost:3001', [])

  const loadStatus = async () => {
    const s = await api<Json>('/api/status', { cache: 'no-store' })
    setStatus({
      running: Boolean(s?.is_bot_running),
      connected: Boolean(s?.is_connected),
      balance: s?.balance ?? 0,
      account: s?.account_type ?? 'PRACTICE',
      hud_step: s?.hud_max_step ?? 0
    })
  }

  useEffect(() => {
    // initial + polling
    ;(async () => { await loadStatus() })()
    timerRef.current = setInterval(loadStatus, pollMs)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // ------------ actions ------------
  const startBot = async () => {
    try {
      setBusyStart(true)
      const payload = {
        assets: parseAssets(assetsText),
        duration: Number(duration) as 1 | 5,
        amount: Number(amount || '0') || 0,
        block_start: blockStart || null,
        block_end: blockEnd || null,
        lead_time_sec: Number(lead || '0') || 0,
        strategy_name: strategy || 'Baseline',
        micro_filter_5m: Boolean(micro5m)
      }
      await api('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      setLastPayload(payload)
      await loadStatus()
      success('Bot started ✓')
    } catch (e: any) {
      error(e?.message || 'Start failed')
    } finally {
      setBusyStart(false)
    }
  }

  const stopBot = async () => {
    try {
      setBusyStop(true)
      await api('/api/bot/stop', { method: 'POST', expectJson: true })
      await loadStatus()
      info('Bot stopped')
    } catch (e: any) {
      error(e?.message || 'Stop failed')
    } finally {
      setBusyStop(false)
    }
  }

  const running = Boolean(status?.running)
  const connected = Boolean(status?.connected)

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="mb-1 text-sm text-gray-500">Engine API: {engineApiBase}</div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* left column: form */}
        <div className="space-y-3">
          <div>
            <div className="text-xs mb-1 text-gray-600">Assets (comma/space separated)</div>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={assetsText}
              onChange={(e) => setAssetsText(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1 text-gray-600">Block start (HH:mm)</div>
              <input className="w-full rounded-md border px-3 py-2" value={blockStart} onChange={e => setBlockStart(e.target.value)} />
            </div>
            <div>
              <div className="text-xs mb-1 text-gray-600">Block end (HH:mm)</div>
              <input className="w-full rounded-md border px-3 py-2" value={blockEnd} onChange={e => setBlockEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs mb-1 text-gray-600">Duration</div>
              <select className="w-full rounded-md border px-3 py-2" value={duration} onChange={e => setDuration(e.target.value as any)}>
                <option value="1">1 min</option>
                <option value="5">5 min</option>
              </select>
            </div>
            <div>
              <div className="text-xs mb-1 text-gray-600">Amount</div>
              <input className="w-full rounded-md border px-3 py-2" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g,''))} />
            </div>
            <div>
              <div className="text-xs mb-1 text-gray-600">Lead time (sec)</div>
              <input className="w-full rounded-md border px-3 py-2" value={lead} onChange={e => setLead(e.target.value.replace(/[^\d]/g,''))} />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={micro5m} onChange={e => setMicro5m(e.target.checked)} />
            ใช้ micro filter เมื่อ duration = 5m
          </label>

          <div>
            <div className="text-xs mb-1 text-gray-600">Strategy</div>
            <input className="w-full rounded-md border px-3 py-2" value={strategy} onChange={e => setStrategy(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={startBot}
              disabled={busyStart || running || !connected}
              className="rounded-md bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
              title={!connected ? 'ต้อง Connect ก่อน' : 'Start Bot'}
            >
              {busyStart ? 'Starting…' : 'Start Bot'}
            </button>
            <button
              onClick={stopBot}
              disabled={busyStop || !running}
              className="rounded-md bg-rose-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {busyStop ? 'Stopping…' : 'Stop Bot'}
            </button>
          </div>
        </div>

        {/* middle: status */}
        <div className="rounded-lg border p-3 text-xs text-gray-700">
          <div className="font-semibold mb-1">Engine status</div>
          <div>running: <b className={running ? 'text-emerald-600' : 'text-gray-600'}>{String(running)}</b></div>
          <div>connected: <b className={connected ? 'text-emerald-600' : 'text-gray-600'}>{String(connected)}</b></div>
          <div>balance: <b>{Number(status?.balance ?? 0).toFixed(2)} USD</b></div>
          <div>account: <b>{status?.account ?? 'PRACTICE'}</b></div>
          <div>hud step: <b>{status?.hud_step ?? 0}</b></div>
        </div>

        {/* right: last payload */}
        <div className="rounded-lg border p-3 text-xs text-gray-700">
          <div className="font-semibold mb-1">Last start payload</div>
          <div className="h-[180px] overflow-auto rounded bg-gray-50 p-2">
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(lastPayload ?? {}, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
