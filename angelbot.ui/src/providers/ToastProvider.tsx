import { PropsWithChildren, createContext, useContext, useMemo } from 'react'
import { Toaster, toast } from 'sonner'

type ToastAPI = {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

const ToastCtx = createContext<ToastAPI | null>(null)

export function ToastProvider({ children }: PropsWithChildren) {
  // ป้องกัน re-create ฟังก์ชันทุก render
  const api = useMemo<ToastAPI>(() => ({
    success: (m) => toast.success(m),
    error:   (m) => toast.error(m),
    info:    (m) => toast(m),
  }), [])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* UI ของ sonner */}
      <Toaster position="top-right" richColors />
    </ToastCtx.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
