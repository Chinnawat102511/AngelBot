// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // ปรับให้ตรงกับพอร์ตที่ UI รันอยู่
  // ถ้าคงพอร์ต 5173 ได้ ให้ตั้ง baseURL เป็น 5173 และบังคับ strictPort ใน vite (ดูหัวข้อเสริมด้านล่าง)
  use: {
    baseURL: 'http://localhost:5174',
    headless: false,           // ให้เห็นเบราว์เซอร์ตอนรัน
    trace: 'on-first-retry',   // เปิด trace เวลาเทสต์ตก
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // จะเพิ่ม firefox/webkit ทีหลังได้
  ],

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
});
