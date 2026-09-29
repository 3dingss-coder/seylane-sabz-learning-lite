import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './'  →  با هر مسیری روی GitHub Pages کار می‌کند
// (هم https://user.github.io/repo/ و هم دامنه‌ی اختصاصی)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    // در حالت توسعه، درخواست‌های /api به Worker محلی می‌روند.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'es2020', cssCodeSplit: false },
});
