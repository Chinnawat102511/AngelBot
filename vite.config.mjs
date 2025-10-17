// C:\AngelBot\vite.config.mjs
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const r = (...p) => path.resolve(process.cwd(), ...p)

// อ่าน env (รองรับทั้ง URL และ PORT)
const urlFromEnv = process.env.BACKEND_URL
const portFromEnv = process.env.BACKEND_PORT
const backendTarget = urlFromEnv ?? (portFromEnv ? `http://localhost:${portFromEnv}` : 'http://localhost:3001')

export default defineConfig({
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
  host: true,
  port: 5173,
  strictPort: true,
  cors: true,
  hmr: { overlay: true },
  proxy: {
    '/api':       { target: 'http://localhost:3001', changeOrigin: true, secure: false, ws: true },
    '/connect':   { target: 'http://localhost:3001', changeOrigin: true, secure: false, ws: true },
    '/disconnect':{ target: 'http://localhost:3001', changeOrigin: true, secure: false, ws: true },
    '/status':    { target: 'http://localhost:3001', changeOrigin: true, secure: false },
    '/license':   { target: 'http://localhost:3001', changeOrigin: true, secure: false },
    // (อนาคตเผื่อใช้) '/bot', '/trades' อื่น ๆ ก็ชี้ได้เหมือนกัน
  },
},

  build: { outDir: 'dist', emptyOutDir: true },
  preview: { port: 5174, host: true },
})
