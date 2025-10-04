export function parseHM(hm: string): {h:number,m:number} {
  const [h,m] = hm.split(':').map(Number)
  return { h: (h||0), m: (m||0) }
}
export function toDateToday(h: number, m: number): Date {
  const d = new Date()
  d.setSeconds(0,0)
  d.setHours(h, m, 0, 0)
  return d
}
export function addMinutes(date: Date, min: number): Date {
  const d = new Date(date.getTime())
  d.setMinutes(d.getMinutes() + min)
  return d
}
export function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000)
}
export function floorTo5Min(date: Date): Date {
  const d = new Date(date.getTime())
  const minutes = d.getMinutes()
  const floored = minutes - (minutes % 5)
  d.setMinutes(floored, 0, 0)
  return d
}
export function ensureAfter(base: Date, candidate: Date): Date {
  if (candidate.getTime() <= base.getTime()) {
    const d = new Date(candidate.getTime())
    d.setMinutes(d.getMinutes() + 5)
    return d
  }
  return candidate
}
export function niceTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2,'0')
  const mm = String(d.getMinutes()).padStart(2,'0')
  return `${hh}:${mm}`
}
export function msUntil(target: Date): number {
  return Math.max(0, target.getTime() - Date.now())
}
