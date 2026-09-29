// =====================================================================
//  بازسازی دقیق باگ گزارش‌شده:
//  «بعد از ثبت‌نام می‌گوید جلسه‌ی شما تمام شد» و «موقع ورود: Failed to fetch»
//
//  علت: کد، خطای شبکه را با «توکن باطل» اشتباه می‌گرفت و جلسه‌ی سالم را
//  پاک می‌کرد؛ و پیام خام انگلیسی fetch را به کاربر نشان می‌داد.
// =====================================================================
import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter } from 'react-router-dom';
import { SessionProvider } from './store';
import App from './App';
import { api, getCachedUser, getToken, setSession, type User } from './api';

const realFetch = global.fetch;

let current: ReturnType<typeof render> | null = null;
function goto(hash: string) {
  window.location.hash = hash;
}
function mountApp() {
  current?.unmount();
  current = render(
    <HashRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </HashRouter>,
  );
  return current;
}

afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

/** ثبت‌نام یک کاربر واقعی و گرفتن توکن معتبر */
async function makeUser() {
  const phone = `096${String(Date.now()).slice(-8)}`;
  const res = await api<{ token: string; user: User }>('/api/signup', {
    method: 'POST',
    body: { firstName: 'کاربر', lastName: 'شبکه', phone },
    auth: false,
  });
  setSession(res.token, res.user);
  return { phone, token: res.token };
}

describe('قطعی سرور نباید کاربر را بیرون بیندازد', () => {
  it('با توکن معتبر و سرور خاموش، جلسه حفظ می‌شود و «پایان جلسه» نمی‌گوید', async () => {
    const { token } = await makeUser();
    expect(getToken()).toBe(token);

    // سرور را از دسترس خارج می‌کنیم — دقیقاً همان «Failed to fetch»
    global.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    goto('#/brands');
    mountApp();

    // کمی صبر می‌کنیم تا بررسی اولیه‌ی توکن انجام شود
    await new Promise((r) => setTimeout(r, 300));

    // پیام پایان جلسه نباید بیاید
    expect(
      screen.queryByText(/جلسه‌ی شما تمام شد/),
      'با خطای شبکه نباید پیام پایان جلسه نشان داده شود',
    ).toBeNull();

    // توکن و کاربر باید سر جایشان باشند
    expect(getToken(), 'توکن نباید پاک شود').toBe(token);
    expect(getCachedUser(), 'کاربر نباید پاک شود').not.toBeNull();

    // و به صفحه‌ی ورود پرتاب نشویم
    expect(window.location.hash, 'نباید به صفحه‌ی ورود برود').toBe('#/brands');
  });

  it('فقط 401 واقعی باعث پایان جلسه می‌شود', async () => {
    await makeUser();

    // سرور بالا است ولی توکن را باطل فرض می‌کنیم
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: 'لطفاً دوباره وارد شوید.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    goto('#/brands');
    mountApp();

    await waitFor(() => expect(window.location.hash).toBe('#/login'), { timeout: 5_000 });
    expect(getToken()).toBeNull();
    expect(await screen.findByText(/جلسه‌ی شما تمام شده بود/)).toBeInTheDocument();
  });

  it('هنگام قطعی سرور، پیام فارسی می‌دهد نه «Failed to fetch»', async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    goto('#/login');
    mountApp();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('شماره موبایل'), '09121234567');
    await user.click(screen.getByRole('button', { name: /^ورود$/ }));

    const message = await screen.findByRole('alert');
    expect(message.textContent).toContain('اتصال به سرور برقرار نشد');
    expect(message.textContent).not.toContain('Failed to fetch');
  });

  it('بعد از برگشتن اتصال، همان کاربر بدون ورود دوباره ادامه می‌دهد', async () => {
    const { phone } = await makeUser();

    // قطع
    global.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    goto('#/brands');
    mountApp();
    await new Promise((r) => setTimeout(r, 200));
    expect(getToken(), 'توکن باید مانده باشد').toBeTruthy();

    // وصل
    global.fetch = realFetch;
    current?.unmount();
    goto('#/brands');
    mountApp();

    expect(await screen.findByText('پیشرفت کلی آموزش شما', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/brands');
    expect(getCachedUser()?.phone).toBe(phone);
  });
});

// =====================================================================
//  باگ واقعیِ گزارش‌شده: پروکسی پیش‌نمایش هدر Authorization را حذف
//  می‌کرد؛ در نتیجه کاربر با توکن معتبر ۴۰۱ و «جلسه‌ی شما تمام شد»
//  می‌دید. توکن باید از راه جایگزین هم به سرور برسد.
// =====================================================================
describe('رسیدن توکن به سرور وقتی پروکسی Authorization را حذف می‌کند', () => {
  it('هر درخواستِ احراز هویت‌شده، توکن را با دو هدر می‌فرستد', async () => {
    const { token } = await makeUser();
    const seen: Record<string, string> = {};
    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      Object.assign(seen, (init?.headers ?? {}) as Record<string, string>);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    await api('/api/health');

    expect(seen['Authorization']).toBe(`Bearer ${token}`);
    expect(seen['X-Auth-Token']).toBe(token);
  });

  it('با حذف کامل Authorization توسط پروکسی، جلسه سالم می‌ماند', async () => {
    await makeUser();

    // پروکسی را شبیه‌سازی می‌کنیم: هدر Authorization را می‌گیرد و بقیه را
    // به سرور واقعی می‌فرستد. اگر سرور X-Auth-Token را قبول نکند، ۴۰۱ می‌شود.
    global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.delete('Authorization');
      return realFetch(String(url), { ...init, headers });
    }) as unknown as typeof fetch;

    goto('#/brands');
    mountApp();

    expect(
      await screen.findByText('پیشرفت کلی آموزش شما', {}, { timeout: 10_000 }),
      'با وجود حذف Authorization، کاتالوگ باید بارگذاری شود',
    ).toBeInTheDocument();
    expect(screen.queryByText(/جلسه‌ی شما تمام شد/)).not.toBeInTheDocument();
    expect(getToken(), 'توکن نباید پاک شود').toBeTruthy();
  });
});
