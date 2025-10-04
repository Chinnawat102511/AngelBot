import React from 'react'

export default function CandlePicker(props: {
  startColor: 'GREEN'|'RED',
  endColor: 'GREEN'|'RED',
  onChange: (start:'GREEN'|'RED', end:'GREEN'|'RED')=>void
}) {
  const { startColor, endColor } = props
  return (
    <Box>
      <Label>Candle Colors (Start → End)</Label>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <Chip active={startColor==='GREEN'} onClick={()=>props.onChange('GREEN', endColor)}>Start: GREEN</Chip>
        <Chip active={startColor==='RED'} onClick={()=>props.onChange('RED', endColor)}>Start: RED</Chip>
        <span style={{ color:'#61788f', fontSize:12 }}>→</span>
        <Chip active={endColor==='GREEN'} onClick={()=>props.onChange(startColor,'GREEN')}>End: GREEN</Chip>
        <Chip active={endColor==='RED'} onClick={()=>props.onChange(startColor,'RED')}>End: RED</Chip>
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
function Chip(props: React.PropsWithChildren<{active?: boolean, onClick?: ()=>void}>) {
  return (
    <button onClick={props.onClick} style={{
      border:'1px solid #2a3a4a', borderRadius:999, padding:'6px 10px',
      background: props.active ? '#2dd4bf' : 'transparent', color: props.active ? '#0b0f14' : '#e8edf2',
      cursor:'pointer', fontWeight:700
    }}>
      {props.children}
    </button>
  )
}
