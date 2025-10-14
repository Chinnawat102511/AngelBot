import { useEffect, useState } from 'react'
import { useToast } from './providers/ToastProvider'
import { useLive } from './providers/LiveProvider'

export default function App() {
  const { success, error, info } = useToast()
  const { online } = useLive()

  const [team, setTeam] = useState('AngelTeam')
  const [days, setDays] = useState('30')
  const [status, setStatus] = useState<any>({})
  const [connected, setConnected] = useState(false)

  // busy flags
  const [bConnect, setBConnect] = useState(false)
  const [bGen, setBGen] = useState(false)
  const [bVerify, setBVerify] = useState(false)
  const [bPing, setBPing] = useState(false)
  const [bRefresh, setBRefresh] = useState(false)

  // file for verify
  const [file, setFile] = useState<File | null>(null)

  const fetchStatus = async () => {
    const r = await fetch('/api/license/status', { cache: 'no-store' })
    const d = await r.json()
    setStatus(d)
    return d
  }

  const connect = async () => {
    try {
      setBConnect(true)
      const res = await fetch('/connect', { method: 'POST' })
      if (!res.ok) throw new Error(`connect ${res.status}`)
      const data = await res.json().catch(() => ({}))
      setConnected(Boolean(data.connected ?? true))
      await fetchStatus()
      success('Connected ✓')
    } catch (e: any) {
      setConnected(false)
      error(e?.message || 'Connect failed')
    } finally {
      setBConnect(false)
    }
  }

  const verify = async () => {
  try {
    setBVerify(true)

    // ส่งเป็น multipart/form-data เสมอ
    const form = new FormData()
    if (file) form.append('file', file, file.name) // มีไฟล์ก็แนบไป

    const r = await fetch('/license/check', {
      method: 'POST',
      body: form,              // ห้ามเซ็ต Content-Type เอง ให้เบราว์เซอร์ตั้ง boundary ให้
    })

    if (!r.ok) throw new Error(`verify ${r.status}`)

    const d = await r.json().catch(() => ({}))
    setStatus(d)
    success('Verify OK')
  } catch (e: any) {
    error(e?.message || 'Verify failed')
  } finally {
    setBVerify(false)
  }
}

  const generate = async () => {
    try {
      setBGen(true)
      const payload = { team, days: Number(days) }
      const r = await fetch('/api/license/gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error(`generate ${r.status}`)
      await fetchStatus()
      success('Generated ✓')
    } catch (e: any) {
      error(e?.message || 'Generate failed')
    } finally {
      setBGen(false)
    }
  }

  const ping = async () => {
    try {
      setBPing(true)
      const r = await fetch('/api/ping', { cache: 'no-store' })
      r.ok ? success('Server OK') : error('Server Offline')
    } finally {
      setBPing(false)
    }
  }

  const refresh = async () => {
    try {
      setBRefresh(true)
      await fetchStatus()
      info('Status refreshed')
    } finally {
      setBRefresh(false)
    }
  }

  const expired =
    !status?.ok ||
    status?.status === 'expired' ||
    (typeof status?.days_left === 'number' && status.days_left <= 0)

  useEffect(() => {
    (async () => {
      const d = await fetchStatus().catch(() => ({}))
      if (d?.ok) setConnected(true)
    })()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl p-6">
        {expired && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            หมดอายุแล้ว — กรุณาอัปโหลด/ต่ออายุ
          </div>
        )}

        <h1 className="mb-4 text-2xl font-bold">AngelBot License Console</h1>

        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="mb-3 text-xs text-gray-500">
            HomeAdminAPI: http://localhost:3001
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              className="w-64 rounded-md border px-3 py-2"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="Team"
            />
            <input
              className="w-24 rounded-md border px-3 py-2"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Days"
            />
            <button
              onClick={generate}
              disabled={bGen}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bGen ? 'Generating…' : 'Generate'}
            </button>

            <div className="ml-auto text-sm text-emerald-600">
              {online ? 'Server Online' : 'Server Offline'} · {connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              onClick={connect}
              disabled={bConnect}
              className="rounded-md bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
            >
              {bConnect ? 'Connecting…' : 'Connect'}
            </button>

            <button
              onClick={verify}
              disabled={bVerify}
              className="rounded-md bg-gray-700 px-3 py-2 text-white disabled:opacity-50"
            >
              {bVerify ? 'Verifying…' : 'Verify'}
            </button>

            <label className="mx-2 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              onClick={ping}
              disabled={bPing}
              className="rounded-md bg-gray-600 px-3 py-2 text-white disabled:opacity-50"
            >
              {bPing ? 'Pinging…' : 'Ping'}
            </button>

            <button
              onClick={refresh}
              disabled={bRefresh}
              className="rounded-md bg-gray-500 px-3 py-2 text-white disabled:opacity-50"
            >
              {bRefresh ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-[#0b1220] p-3 text-xs text-[#cde1ff]">
            {JSON.stringify(status ?? {}, null, 2)}
          </pre>
        </div>

        <footer className="mt-6 text-center text-xs text-gray-400">
          © AngelTeam — License System Connected
        </footer>
      </div>
    </div>
  )
}
