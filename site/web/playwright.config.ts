import { defineConfig, devices } from '@playwright/test';

// تست مرورگر واقعی روی دیوایس‌های مختلف.
// چون دانلود مرورگر در بعضی محیط‌ها بسته است، این تست در GitHub Actions اجرا می‌شود.
//   محلی:  npm run test:browser   (اول Worker و Vite را خودش بالا می‌آورد)
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-pixel7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-iphone13',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node ../scripts/serve-all.mjs',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
