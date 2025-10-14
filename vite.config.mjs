// C:\AngelBot\vite.config.mjs
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const r = (...p) => path.resolve(process.cwd(), ...p)

export default defineConfig({
  // ให้ Vite มอง root เป็นโฟลเดอร์ UI
  root: 'angelbot.ui',

  plugins: [react()],

  resolve: {
    alias: {
      '@': r('angelbot.ui/src'),
      '@providers': r('angelbot.ui/src/providers'),
      '@components': r('angelbot.ui/src/components'),
      '@pages': r('angelbot.ui/src/pages'),
      '@lib': r('angelbot.ui/src/lib'),
    },
  },

  server: {
    host: true,          // เปิดรับทุก interface (ใช้ได้ทั้ง localhost / IP)
    port: 5173,
    strictPort: true,    // ถ้าพอร์ตถูกใช้อยู่ ให้ error เลย (ไม่สลับพอร์ต)
    cors: true,          // อนุญาต CORS ใน dev (กันบาง lib เช็ค origin)
    hmr: { overlay: true },

    // ⬇️ proxy ไป backend :3001 ครอบทั้ง HTTP + WebSocket
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/connect': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true, // เผื่อ backend อัพเกรดเป็น WS
      },
      // เส้น root ที่ backend เปิดไว้
      '/status': { target: 'http://localhost:3001', changeOrigin: true, secure: false },
      '/license': { target: 'http://localhost:3001', changeOrigin: true, secure: false },
    },
  },

  // build ออกโฟลเดอร์ dist (อยู่ใต้ angelbot.ui)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  // preview สำหรับทดสอบไฟล์ build แล้ว (vite preview)
  preview: {
    port: 5174,
    host: true,
  },
})
