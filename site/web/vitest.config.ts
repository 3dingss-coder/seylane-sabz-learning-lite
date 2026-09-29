import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// تست یکپارچگی رابط کاربری: کامپوننت‌های واقعی React روی jsdom،
// در برابر Worker واقعی که باید روی این آدرس در حال اجرا باشد.
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(
      process.env.VITE_API_BASE ?? 'http://127.0.0.1:8787',
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['src/**/*.test.tsx'],
  },
});
