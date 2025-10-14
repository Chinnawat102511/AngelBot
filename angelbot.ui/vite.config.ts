import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@providers': path.resolve(__dirname, 'src/providers'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@lib': path.resolve(__dirname, 'src/lib'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true, secure: false },
      '/ws' : { target: 'ws://localhost:3001', ws: true, changeOrigin: true, secure: false },
    },
  },
})
