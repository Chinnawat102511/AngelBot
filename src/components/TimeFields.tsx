import React from 'react'

export default function TimeFields(props: {
  start: string, end: string,
  onChange: (start: string, end: string)=>void
}) {
  return (
    <Box>
      <Label>Start / End (HH:MM)</Label>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <Input value={props.start} onChange={e=>props.onChange(e.target.value, props.end)} />
        <span style={{ color:'#61788f', fontSize:12 }}>→</span>
        <Input value={props.end} onChange={e=>props.onChange(props.start, e.target.value)} />
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
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} placeholder="HH:MM" style={{
    padding:'8px 10px', borderRadius:10, outline:'none', border:'1px solid #2a3a4a', background:'transparent', color:'#e8edf2', width:110
  }} />
}
