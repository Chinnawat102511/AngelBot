import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,                 // port ของ UI
    proxy: {
      // เส้นทางที่ UI ใช้เรียก backend → proxy ไปที่พอร์ต backend
      '/engine':  'http://127.0.0.1:9050',
      '/license': 'http://127.0.0.1:9050',
      '/system':  'http://127.0.0.1:9050',
      '/trades':  'http://127.0.0.1:9050',
      '/ai':      'http://127.0.0.1:9050',
      '/market':  'http://127.0.0.1:9050',
    }
  }
});
