import React from 'react'

export default function TrendToggle(props: { trend: 'UP'|'DOWN', onChange: (v:'UP'|'DOWN')=>void }) {
  const { trend, onChange } = props
  return (
    <Box>
      <Label>Trend</Label>
      <div style={{ display:'flex', gap:8 }}>
        <Btn active={trend==='UP'} onClick={()=>onChange('UP')}>UP</Btn>
        <Btn active={trend==='DOWN'} onClick={()=>onChange('DOWN')}>DOWN</Btn>
      </div>
    </Box>
  )
}

function Box(props: React.PropsWithChildren) {
  return <div style={{ padding:12, border:'1px solid #17202a', borderRadius:12, background:'#0f151d' }}>{props.children}</div>
}
function Label(props: React.PropsWithChildren) {
  return <div style={{ fontSize:12, color:'#9db2c7', marginBottom:8 }}>{props.children}</div>
}
function Btn(props: React.PropsWithChildren<{active?: boolean, onClick?: ()=>void}>) {
  return (
    <button onClick={props.onClick} style={{
      border:'1px solid #2a3a4a', borderRadius:10, padding:'8px 12px',
      background: props.active ? '#9bd0ff' : 'transparent', color: props.active ? '#0b0f14' : '#e8edf2',
      cursor:'pointer', fontWeight:700
    }}>
      {props.children}
    </button>
  )
}
