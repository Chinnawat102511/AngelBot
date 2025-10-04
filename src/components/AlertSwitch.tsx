import React, { useEffect, useRef, useState } from 'react'
import { msUntil } from '@lib/time'

export default function AlertSwitch(props: { targetTime: Date, label?: string }) {
  const [enabled, setEnabled] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    const ms = msUntil(props.targetTime)
    if (ms <= 0) {
      ping(); setEnabled(false); return
    }
    timerRef.current = window.setTimeout(() => {
      ping(); setEnabled(false)
    }, ms)
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [enabled, props.targetTime])

  return (
    <button onClick={()=>setEnabled(v=>!v)} style={btn(enabled)}>
      {enabled ? 'Alert: ON' : (props.label || 'Alert')}
    </button>
  )
}

function ping() {
  // เสียง beep สั้น ๆ
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'sine'; o.frequency.value = 880
  g.gain.value = 0.08
  o.start(); setTimeout(()=>{o.stop(); ctx.close()}, 400)
  alert('ถึงเวลา Reversal แล้ว!')
}

function btn(active: boolean): React.CSSProperties {
  return {
    border:'1px solid #2a3a4a', borderRadius:10, padding:'8px 12px',
    background: active ? '#22c55e' : 'transparent', color: active ? '#0b0f14' : '#e8edf2',
    cursor:'pointer', fontWeight:700
  }
}
