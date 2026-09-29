// =====================================================================
//  بازسازی باگ گزارش‌شده: «بعد از ثبت‌نام/ورود، دوباره به صفحه‌ی ورود
//  برمی‌گردم». مسیرهای زیر را با شبیه‌سازی «رفرش صفحه» (unmount + mount)
//  امتحان می‌کند — همان چیزی که تست‌های قبلی پوشش نمی‌دادند.
// =====================================================================
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter } from 'react-router-dom';
import { SessionProvider } from './store';
import App from './App';
import { getCachedUser, getToken } from './api';

const digits = String(Date.now()).slice(-9);
const phone = `095${digits}`.slice(0, 11);

function goto(hash: string) {
  window.location.hash = hash;
}

let current: ReturnType<typeof render> | null = null;

function mountApp() {
  // رفرش واقعی یعنی نسخه‌ی قبلی کاملاً از بین می‌رود. اگر unmount نکنیم،
  // دو اپ هم‌زمان به hashchange گوش می‌دهند و نتیجه‌ی تست بی‌معنی می‌شود.
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

/** شبیه‌سازی رفرش مرورگر: همه‌چیز unmount و دوباره mount می‌شود. */
function reload() {
  return mountApp();
}

async function signup() {
  goto('#/signup');
  const view = mountApp();
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('نام'), 'سارا');
  await user.type(screen.getByLabelText('نام خانوادگی'), 'احمدی');
  await user.type(screen.getByLabelText('شماره موبایل'), phone);
  await user.click(screen.getByRole('button', { name: /ثبت‌نام و ورود/ }));
  await waitFor(() => expect(window.location.hash).toBe('#/brands'), { timeout: 10_000 });
  return view;
}

describe('ماندگاری جلسه (باگ گزارش‌شده)', () => {
  it('ثبت‌نام → کاربر در /brands می‌ماند و بیرون انداخته نمی‌شود', async () => {
    await signup();

    // باید روی صفحه‌ی برندها بمانیم، نه اینکه به ورود برگردیم
    expect(window.location.hash).toBe('#/brands');
    expect(await screen.findByText('پیشرفت کلی آموزش شما')).toBeInTheDocument();

    // توکن و کاربر ذخیره شده‌اند
    expect(getToken()).toBeTruthy();
    expect(getCachedUser()?.phone).toBe(phone);

    // و چند ثانیه بعد هم بیرون نیفتد
    await new Promise((r) => setTimeout(r, 500));
    expect(window.location.hash).toBe('#/brands');
  });

  it('بعد از «رفرش صفحه» کاربر وارد می‌ماند', async () => {
    await signup();
    const token = getToken();
    expect(token).toBeTruthy();

    // --- رفرش ---
    goto('#/brands');
    reload();

    // نباید به صفحه‌ی ورود پرتاب شویم
    await waitFor(
      () => expect(screen.queryByLabelText('شماره موبایل')).not.toBeInTheDocument(),
      { timeout: 10_000 },
    );
    expect(await screen.findByText('پیشرفت کلی آموزش شما', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/brands');
    expect(getToken()).toBe(token);
  });

  it('خروج و ورود دوباره فقط با شماره، کاربر را داخل می‌برد', async () => {
    await signup();

    // خروج
    goto('#/me');
    reload();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /خروج از حساب/ }, { timeout: 10_000 }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));

    // ورود
    goto('#/login');
    reload();
    await user.type(await screen.findByLabelText('شماره موبایل'), phone);
    await user.click(screen.getByRole('button', { name: /^ورود$/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/brands'), { timeout: 10_000 });
    expect(await screen.findByText('پیشرفت کلی آموزش شما', {}, { timeout: 10_000 })).toBeInTheDocument();

    // و بعد از رفرش هم هنوز داخل است
    reload();
    expect(await screen.findByText('پیشرفت کلی آموزش شما', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/brands');
  });

  it('کاربر واردشده در صفحه‌ی ورود نمی‌ماند و مستقیم به اپ می‌رود', async () => {
    await signup();
    goto('#/login');
    reload();
    // اگر وارد است، فرم ورود نباید نمایش داده شود
    await waitFor(() => expect(window.location.hash).not.toBe('#/login'), { timeout: 10_000 });
    expect(window.location.hash).toBe('#/brands');
  });

  it('رفرش روی صفحه‌ی «حساب من»، کاربر را به ورود نمی‌فرستد', async () => {
    await signup();
    goto('#/me');
    reload();
    // «حساب من» هم در نوار بالا و هم در ناوبری پایین هست، پس همه‌ی نمونه‌ها را می‌گیریم
    const matches = await screen.findAllByText('حساب من', {}, { timeout: 10_000 });
    expect(matches.length).toBeGreaterThan(0);
    expect(window.location.hash).toBe('#/me');
    expect(await screen.findByRole('button', { name: /خروج از حساب/ })).toBeInTheDocument();
  });
});
