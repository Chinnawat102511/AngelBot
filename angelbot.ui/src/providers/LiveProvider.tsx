import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

type LiveAPI = {
  online: boolean
}

const LiveCtx = createContext<LiveAPI>({ online: true })
export const useLive = () => useContext(LiveCtx)

export const LiveProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [online, setOnline] = useState(true)
  const pingTimer = useRef<number | null>(null)

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/ping', { cache: 'no-store' })
        setOnline(res.ok)
      } catch {
        setOnline(false)
      }
    }

    // เริ่มเช็คทันที + ทุก ๆ 5 วิ
    tick()
    pingTimer.current = window.setInterval(tick, 5000)

    return () => {
      if (pingTimer.current) window.clearInterval(pingTimer.current)
    }
  }, [])

  return <LiveCtx.Provider value={{ online }}>{children}</LiveCtx.Provider>
}
