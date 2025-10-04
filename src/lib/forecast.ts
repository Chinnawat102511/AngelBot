import { addMinutes, diffMinutes, ensureAfter, floorTo5Min, parseHM, toDateToday } from './time'

export type Trend = 'UP'|'DOWN'
export type Candle = 'GREEN'|'RED'

type Inp = {
  trend: Trend
  start: string // 'HH:MM'
  end: string   // 'HH:MM'
  startColor: Candle
  endColor: Candle
}

type Out = {
  forecastTime: Date
  direction: 'UP'|'DOWN'
  levelColor: 'แดง'|'เหลือง'|'ขาว'
  flags: string[]
  minutesSpan: number
  leadMinutes: number
}

/** Rule set:
 * - ต้องคำนวณเมื่อ span >= 6 นาที; ถ้าน้อยกว่า 6 ให้คำนวณได้แต่ติดธง 'เวลาน้อยเกินไป'
 * - ถ้า span >= 41 นาที ให้คำนวณปกติและติดธง 'เวลามากเกินไป'
 * - TF1M ใช้ multiplier = 3
 * - TF5M ใช้ multiplier = 1 และปัดลง 5 นาที (floor) หลังคำนวณ พร้อม ensure > End
 * - Direction = 'กลับตัว' (ตรงข้าม Trend)
 * - Strength สี: คำนวณจากความสอดคล้องของสีแท่งกับเทรนด์
 *   mapping: GREEN = +1, RED = -1, Trend UP=+1, DOWN=-1
 *   score = trendSign*start + trendSign*end
 *   score=-2 => แรงมาก 'แดง'; score=0 => 'เหลือง'; score=+2 => 'ขาว'
 */

const toSign = (trend: Trend) => trend === 'UP' ? 1 : -1
const candleSign = (c: Candle) => c === 'GREEN' ? 1 : -1

export function computeForecastTF1M(inp: Inp): Out {
  const { trend, start, end, startColor, endColor } = inp
  const s = parseHM(start); const e = parseHM(end)
  const sD = toDateToday(s.h, s.m)
  const eD = toDateToday(e.h, e.m)
  const span = Math.max(0, diffMinutes(sD, eD))

  const flags: string[] = []
  if (span < 6) flags.push('เวลาน้อยเกินไป (< 6 นาที)')
  if (span >= 41) flags.push('เวลามากเกินไป (≥ 41 นาที)')

  const lead = Math.ceil(span * 3) // multiplier 3
  const raw = addMinutes(eD, lead)
  const forecast = ensureAfter(eD, raw)

  const direction: 'UP'|'DOWN' = trend === 'UP' ? 'DOWN' : 'UP'
  const score = toSign(trend)*candleSign(startColor) + toSign(trend)*candleSign(endColor)
  const level: Out['levelColor'] = score <= -1 ? 'แดง' : (score === 0 ? 'เหลือง' : 'ขาว')

  return { forecastTime: forecast, direction, levelColor: level, flags, minutesSpan: span, leadMinutes: lead }
}

export function computeForecastTF5M(inp: Inp): Out {
  const { trend, start, end, startColor, endColor } = inp
  const s = parseHM(start); const e = parseHM(end)
  const sD = toDateToday(s.h, s.m)
  const eD = toDateToday(e.h, e.m)
  const span = Math.max(0, diffMinutes(sD, eD))

  const flags: string[] = []
  if (span < 6) flags.push('เวลาน้อยเกินไป (< 6 นาที)')
  if (span >= 41) flags.push('เวลามากเกินไป (≥ 41 นาที)')

  const lead = Math.ceil(span * 1) // multiplier 1
  const raw = addMinutes(eD, lead)
  const floored = floorTo5Min(raw)          // ปัดลง 5 นาที
  const forecast = ensureAfter(eD, floored) // ต้องมากกว่า End เสมอ

  const direction: 'UP'|'DOWN' = trend === 'UP' ? 'DOWN' : 'UP'
  const score = toSign(trend)*candleSign(startColor) + toSign(trend)*candleSign(endColor)
  const level: Out['levelColor'] = score <= -1 ? 'แดง' : (score === 0 ? 'เหลือง' : 'ขาว')

  return { forecastTime: forecast, direction, levelColor: level, flags, minutesSpan: span, leadMinutes: lead }
}

export function explainInfo(o: Out) {
  return `Span=${o.minutesSpan} นาที, Lead=${o.leadMinutes} นาที → เวลา ${o.direction} | สี ${o.levelColor}`
}
