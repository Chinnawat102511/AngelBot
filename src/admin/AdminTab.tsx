import React, { useMemo, useState } from 'react'

type LicensePayload = {
  userId: string
  plan: string
  expiresAt?: string // ISO หรือเว้นว่างให้ server ใส่ default 30 วัน
  features: string[]
}

export default function AdminTab() {
  // ฟอร์มเบสิค
  const [userId, setUserId] = useState('AngelTeamLeader')
  const [plan, setPlan] = useState('pro')
  const [expiresLocal, setExpiresLocal] = useState<string>('') // datetime-local
  const [featuresText, setFeaturesText] = useState('forecast,alert')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const payload: LicensePayload = useMemo(() => {
    const ft = featuresText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    // แปลง datetime-local -> ISO (ถ้าใส่มา)
    let iso: string | undefined = undefined
    if (expiresLocal) {
      // datetime-local เป็น local time (เช่น 2025-12-31T23:59)
      const d = new Date(expiresLocal)
      iso = d.toISOString()
    }

    return { userId, plan, expiresAt: iso, features: ft }
  }, [userId, plan, expiresLocal, featuresText])

  async function onGenerate() {
    try {
      setLoading(true); setError(''); setResult(null)

      const res = await fetch('http://localhost:8787/api/license/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult(data)

      // data รูปแบบ: { ok: true, license: { file, license } }
      const licenseObj = data?.license?.license
      if (licenseObj) {
        const fileName =
          `${licenseObj.userId || 'license'}_${Date.now()}.license.json`
        const content = JSON.stringify(licenseObj, null, 2)
        const blob = new Blob([content], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = fileName
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ color:'#e8edf2', margin: 0 }}>Admin — License Generator</h2>

      <Row label="User ID">
        <Input value={userId} onChange={e=>setUserId(e.target.value)} />
      </Row>

      <Row label="Plan">
        <Input value={plan} onChange={e=>setPlan(e.target.value)} />
      </Row>

      <Row label="Expires At (local)">
        <input
          type="datetime-local"
          value={expiresLocal}
          onChange={e=>setExpiresLocal(e.target.value)}
          style={inputStyle}
        />
        <small style={{ color:'#9db2c7' }}>
          เว้นว่างได้ (default 30 วัน) — ถ้าใส่จะถูกแปลงเป็น ISO ก่อนส่ง
        </small>
      </Row>

      <Row label="Features (comma)">
        <Input value={featuresText} onChange={e=>setFeaturesText(e.target.value)} />
      </Row>

      <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
        <button onClick={onGenerate} disabled={loading} style={btnStyle(loading)}>
          {loading ? 'กำลังสร้าง...' : 'สร้าง License + ดาวน์โหลด'}
        </button>
        <a href="http://localhost:8787/api/ping" target="_blank" style={linkBtn}>
          ทดสอบ /api/ping
        </a>
      </div>

      {error && (
        <div style={{ color:'#ff7d7d', fontSize:13 }}>
          Error: {error}
        </div>
      )}

      {result && (
        <pre style={preStyle}>
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

function Row(props: React.PropsWithChildren<{label: string}>) {
  return (
    <div style={{ border:'1px solid #17202a', borderRadius:12, padding:12, background:'#0f151d' }}>
      <div style={{ fontSize:12, color:'#9db2c7', marginBottom:8 }}>{props.label}</div>
      {props.children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={inputStyle} />
}

const inputStyle: React.CSSProperties = {
  padding:'8px 10px',
  borderRadius:10,
  outline:'none',
  border:'1px solid #2a3a4a',
  background:'transparent',
  color:'#e8edf2',
  minWidth: 240
}

const btnStyle = (loading:boolean): React.CSSProperties => ({
  border:'1px solid #2a3a4a',
  borderRadius:10,
  padding:'8px 12px',
  background: loading ? '#64748b' : '#22c55e',
  color: '#0b0f14',
  cursor: loading ? 'not-allowed' : 'pointer',
  fontWeight: 800
})

const linkBtn: React.CSSProperties = {
  display:'inline-block',
  color:'#0b0f14',
  background:'#9bd0ff',
  border:'1px solid #9bd0ff',
  borderRadius:12,
  padding:'8px 12px',
  textDecoration:'none',
  fontWeight:700
}

const preStyle: React.CSSProperties = {
  margin:0,
  padding:12,
  background:'#0b0f14',
  border:'1px solid #17202a',
  borderRadius:12,
  color:'#9bd0ff',
  maxHeight: 300,
  overflow:'auto'
}
