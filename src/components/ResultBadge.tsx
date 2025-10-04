import React from 'react'

export default function ResultBadge(props: { label: string, value: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ fontSize:12, color:'#9db2c7', width:120 }}>{props.label}</div>
      <div style={{ padding:'6px 10px', border:'1px solid #2a3a4a', borderRadius:10, background:'rgba(155,208,255,.06)', color:'#e8edf2', fontWeight:700 }}>
        {props.value}
      </div>
    </div>
  )
}
