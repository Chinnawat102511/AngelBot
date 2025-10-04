import React, { useMemo, useState } from 'react'
import TrendToggle from '@components/TrendToggle'
import CandlePicker from '@components/CandlePicker'
import TimeFields from '@components/TimeFields'
import ResultBadge from '@components/ResultBadge'
import AlertSwitch from '@components/AlertSwitch'
import Countdown from '@components/Countdown'
import { computeForecastTF1M, explainInfo } from '@lib/forecast'
import { niceTime } from '@lib/time'

export default function TF1M() {
  const [trend, setTrend] = useState<'UP'|'DOWN'>('UP')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('09:12')
  const [startColor, setStartColor] = useState<'GREEN'|'RED'>('GREEN')
  const [endColor, setEndColor] = useState<'GREEN'|'RED'>('RED')

  const out = useMemo(
    () => computeForecastTF1M({ trend, start, end, startColor, endColor }),
    [trend, start, end, startColor, endColor]
  )

  return (
    <Wrap title="TF1M — Reversal Forecast (x3)">
      <Layout>
        <TimeFields
          start={start}
          end={end}
          onChange={(s: string, e: string) => { setStart(s); setEnd(e) }}
        />
        <TrendToggle trend={trend} onChange={setTrend} />
        <CandlePicker
          startColor={startColor}
          endColor={endColor}
          onChange={(a: 'GREEN'|'RED', b: 'GREEN'|'RED') => { setStartColor(a); setEndColor(b) }}
        />

        <div style={{ gridColumn: '1/-1', display: 'grid', gap: 8 }}>
          <ResultBadge label="Forecast Time" value={niceTime(out.forecastTime)} />
          <ResultBadge label="Direction" value={out.direction} />
          <ResultBadge label="Strength" value={out.levelColor} />
          {out.flags.length > 0 && (
            <div style={{ fontSize: 12, color: '#ffd27d' }}>
              หมายเหตุ: {out.flags.join(' • ')}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#9db2c7' }}>{explainInfo(out)}</div>
        </div>

        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertSwitch targetTime={out.forecastTime} label="Auto Alert" />
          <Countdown targetTime={out.forecastTime} />
        </div>
      </Layout>
    </Wrap>
  )
}

function Wrap(props: React.PropsWithChildren<{title: string}>) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 18, color: '#e8edf2' }}>{props.title}</div>
      {props.children}
    </div>
  )
}
function Layout(props: React.PropsWithChildren) {
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
      {props.children}
    </div>
  )
}
