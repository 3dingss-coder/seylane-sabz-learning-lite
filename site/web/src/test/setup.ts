import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom این‌ها را پیاده‌سازی نکرده؛ بدون stub تست با خطا می‌شکند.
beforeEach(() => {
  window.scrollTo = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
