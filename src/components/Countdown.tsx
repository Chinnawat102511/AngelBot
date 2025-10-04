import React, { useEffect, useState } from 'react'
import { msUntil } from '@lib/time'

export default function Countdown(props: { targetTime: Date }) {
  const [left, setLeft] = useState(msUntil(props.targetTime))
  useEffect(()=>{
    const t = setInterval(()=>setLeft(msUntil(props.targetTime)), 250)
    return ()=>clearInterval(t)
  }, [props.targetTime])
  return (
    <div style={{ fontSize:12, color:'#9db2c7' }}>
      เหลือเวลา: {fmt(left)}
    </div>
  )
}
function fmt(ms: number) {
  if (ms <= 0) return '00:00'
  const s = Math.floor(ms/1000)
  const m = Math.floor(s/60)
  const r = s%60
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`
}
