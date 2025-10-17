// src/api.ts  (REPLACE)
export type Json = any

async function api<T = Json>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const getTrades = (limit = 200) => api(`/api/trades?limit=${limit}`)
export const getState = () => api(`/api/state`)
export const resetData = () => api(`/api/reset`, { method: 'POST' })
export const pauseBot = () => api(`/bot/pause`, { method: 'POST' })
export const resumeBot = () => api(`/bot/resume`, { method: 'POST' })
export const startBot = (cfg: any) =>
  api(`/bot/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })

export function openTradesSSE(): EventSource {
  const es = new EventSource('/api/stream/trades')
  return es
}

export async function health() { return api(`/health`) }
