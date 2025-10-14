import { test, expect, Page } from "@playwright/test";

// ใช้พอร์ตดีฟอลต์ 5173 และสามารถ override ได้ด้วย env:
// Windows PowerShell:   $env:UI_BASE='http://localhost:5174/'; npm run test:ui:headed
// Windows cmd.exe:      set UI_BASE=http://localhost:5174/ && npm run test:ui:headed
const BASE = process.env.UI_BASE || "http://localhost:5173/";

test("AngelBot License Console UI stable", async ({ page }: { page: Page }) => {
  await page.goto(BASE);
  await page.waitForLoadState("domcontentloaded");

  // หัวข้อหน้า
  await expect(page.getByRole("heading", { name: /angelbot license console/i })).toBeVisible();

  // ปุ่มหลัก
  await expect(page.getByRole("button", { name: /generate/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /connect/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /verify/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /ping forecast/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();

  // ตัวกระตุ้น Choose File (label หรือปุ่ม)
  const chooseTrigger = page
    .locator('label[for="licenseFile"], button:has-text("Choose File")')
    .first();
  await expect(chooseTrigger).toBeVisible();

  // ไฟล์อินพุตมีอยู่จริง (ไม่ต้อง visible เพราะ hidden เป็นดีไซน์)
  await expect(page.locator('input#licenseFile[type="file"]')).toHaveCount(1);
});
