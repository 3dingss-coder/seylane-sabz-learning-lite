// =====================================================================
//  تست یکپارچگی رابط کاربری:
//  کامپوننت‌های واقعی React (همان‌هایی که بیلد و منتشر می‌شوند) روی jsdom،
//  در برابر Worker واقعی و D1 واقعی.
//
//  اجرا: Worker باید روی ۱۲۷.۰.۰.۱:۸۷۸۷ در حال اجرا باشد، سپس
//        npm run test:ui
// =====================================================================
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter } from 'react-router-dom';
import { SessionProvider } from './store';
import App from './App';
import { api, setSession, type User } from './api';

const API = import.meta.env.VITE_API_BASE as string;
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '09120000001';

// شماره‌ی موبایل ایرانی باید دقیقاً ۱۱ رقم و با 09 شروع شود.
const digits = String(Date.now()).slice(-9);
const makePhone = (prefix: string) => `09${prefix}${digits}`.slice(0, 11);
const stamp = digits.slice(-6);

/** ۱۲ برند واقعی از «لیست برندها و محصولات سیلانه سبز/brands.csv» */
const SEED_BRANDS = [
  'کامان',
  'میسویک',
  'کدکس',
  'کاپوت',
  'دافی',
  'نینو',
  'آمبرال',
  'هیر واتر',
  'پیکسل',
  'میس لیپ',
  'آیس بال',
  'کالمین',
];

function goto(hash: string) {
  window.location.hash = hash;
}

function renderApp() {
  return render(
    <HashRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </HashRouter>,
  );
}

async function signupAs(firstName: string, lastName: string, phone: string) {
  goto('#/signup');
  renderApp();
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('نام'), firstName);
  await user.type(screen.getByLabelText('نام خانوادگی'), lastName);
  await user.type(screen.getByLabelText('شماره موبایل'), phone);
  await user.click(screen.getByRole('button', { name: /ثبت‌نام و ورود/ }));
  await waitFor(() => expect(window.location.hash).toBe('#/brands'), { timeout: 10_000 });
}

/**
 * هر تست با localStorage خالی شروع می‌شود (جداسازی تست‌ها)،
 * پس تست‌هایی که به جلسه‌ی فعال نیاز دارند با این helper وارد می‌شوند.
 */
async function loginPhone(phone: string) {
  const res = await api<{ token: string; user: User }>('/api/login', {
    method: 'POST',
    body: { phone },
    auth: false,
  });
  setSession(res.token, res.user);
}

describe('رابط کاربری بازاریاب', () => {
  it('اتصال سایت به Worker برقرار است', async () => {
    const res = await fetch(`${API}/api/health`);
    expect(res.ok).toBe(true);
    expect((await res.json()).ok).toBe(true);
  });

  it('ثبت‌نام می‌کند و ۱۲ برند واقعی را نشان می‌دهد', async () => {
    await signupAs("سارا", "احمدی", makePhone("3"));

    expect(await screen.findByText('پیشرفت کلی آموزش شما')).toBeInTheDocument();

    // هر ۱۲ برند واقعی کاتالوگ باید در DOM باشند.
    // (شمارش دقیق انجام نمی‌دهیم چون D1 محلی بین اجراها پاک نمی‌شود.)
    for (const name of SEED_BRANDS) {
      expect(await screen.findByText(name), `برند «${name}» باید نمایش داده شود`).toBeInTheDocument();
    }
  });

  it('ورود با شماره‌ی ثبت‌نشده، راهنمای ثبت‌نام نشان می‌دهد', async () => {
    goto('#/login');
    renderApp();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('شماره موبایل'), '09110000099');
    await user.click(screen.getByRole('button', { name: /^ورود$/ }));

    expect(await screen.findByText('این شماره هنوز ثبت نشده است.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ثبت‌نام با همین شماره/ })).toBeInTheDocument();
  });

  it('بدون ورود، از صفحه‌ی برندها به ورود پرتاب می‌شود', async () => {
    goto('#/brands');
    renderApp();
    await waitFor(() => expect(window.location.hash).toBe('#/login'));
    expect(screen.getByLabelText('شماره موبایل')).toBeInTheDocument();
  });

  it('شماره‌ی نامعتبر را قبول نمی‌کند', async () => {
    goto('#/signup');
    renderApp();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('نام'), 'سارا');
    await user.type(screen.getByLabelText('نام خانوادگی'), 'احمدی');
    await user.type(screen.getByLabelText('شماره موبایل'), '123');
    await user.click(screen.getByRole('button', { name: /ثبت‌نام و ورود/ }));

    expect(await screen.findByText(/شماره موبایل را کامل و درست وارد کنید/)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/signup');
  });
});

describe('مسیر کامل: ادمین محتوا می‌سازد، بازاریاب می‌بیند و آزمون می‌دهد', () => {
  const brandName = `برند تست ${stamp}`;
  const productName = `محصول تست ${stamp}`;
  const quizTitle = `آزمون تست ${stamp}`;
  const marketerPhone = makePhone("4");

  let productId = '';

  it('ادمین برند، محصول، آزمون و سه محتوا را می‌سازد', async () => {
    const admin = await api<{ token: string }>('/api/signup', {
      method: 'POST',
      body: { firstName: 'مدیر', lastName: 'سیلانه', phone: ADMIN_PHONE },
      auth: false,
    });
    const t = admin.token;

    const quiz = await api<{ id: string }>('/api/admin/quizzes', {
      method: 'POST',
      token: t,
      body: {
        title: quizTitle,
        passScore: 70,
        questions: [{ q: 'پایتخت ایران؟', options: ['تهران', 'شیراز'], answer: 0 }],
      },
    });
    const brand = await api<{ id: string }>('/api/admin/brands', {
      method: 'POST',
      token: t,
      body: { name: brandName, nameEn: 'Test', logo: '', sortOrder: 99 },
    });
    const product = await api<{ id: string }>('/api/admin/products', {
      method: 'POST',
      token: t,
      body: { brandId: brand.id, name: productName, code: 'TST-1', category: 'تست' },
    });
    productId = product.id;

    await api('/api/admin/contents', {
      method: 'POST',
      token: t,
      body: { productId, kind: 'podcast', title: 'پادکست نمونه', url: 'https://example.com/a.mp3', durationSec: 60 },
    });
    await api('/api/admin/contents', {
      method: 'POST',
      token: t,
      body: { productId, kind: 'video', title: 'ویدئو نمونه', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    await api('/api/admin/contents', {
      method: 'POST',
      token: t,
      body: { productId, kind: 'quiz', title: 'آزمون نمونه', quizId: quiz.id },
    });

    expect(productId).not.toBe('');
  });

  it('بازاریاب همان سه محتوا را در صفحه‌ی محصول می‌بیند', async () => {
    await signupAs('علی', 'رضایی', marketerPhone);

    expect(await screen.findByText(brandName)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByText(brandName));

    expect(await screen.findByText(productName)).toBeInTheDocument();
    await user.click(screen.getByText(productName));

    expect(await screen.findByRole('heading', { name: 'سه مرحله‌ی آموزش این محصول' })).toBeInTheDocument();
    expect(await screen.findByText('پادکست نمونه')).toBeInTheDocument();
    expect(screen.getByText('ویدئو نمونه')).toBeInTheDocument();
    expect(screen.getByText('آزمون نمونه')).toBeInTheDocument();
  });

  it('بازاریاب آزمون می‌دهد و نتیجه را می‌بیند', async () => {
    await loginPhone(marketerPhone);
    // شناسه‌ی محتوای آزمون را از خود API می‌گیریم
    const admin = await api<{ token: string }>('/api/login', {
      method: 'POST',
      body: { phone: ADMIN_PHONE },
      auth: false,
    });
    const contents = await api<{ items: { id: string; kind: string }[] }>('/api/admin/contents', {
      token: admin.token,
    });
    const quizItem = contents.items.find((i) => i.kind === 'quiz');
    expect(quizItem).toBeTruthy();

    goto(`#/quiz/${quizItem?.id}`);
    renderApp();
    const user = userEvent.setup();

    expect(await screen.findByText('پایتخت ایران؟')).toBeInTheDocument();
    await user.click(screen.getByText('تهران'));
    await user.click(screen.getByRole('button', { name: /ثبت و دیدن نتیجه/ }));

    expect(await screen.findByText('قبول شدید، آفرین!')).toBeInTheDocument();
    expect(screen.getByText('۱۰۰٪')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'مرور پاسخ‌ها' })).toBeInTheDocument();
  });

  it('بازاریاب به پنل ادمین راه ندارد', async () => {
    await loginPhone(marketerPhone);
    goto('#/admin');
    renderApp();
    await waitFor(() => expect(window.location.hash).toBe('#/brands'));
  });

  it('ادمین در گزارش، بازاریاب تازه را با پیشرفت درست می‌بیند', async () => {
    const admin = await api<{ token: string }>('/api/login', {
      method: 'POST',
      body: { phone: ADMIN_PHONE },
      auth: false,
    });
    const list = await api<{ items: { phone: string; done: number; quizAvg: number | null }[] }>(
      '/api/admin/marketers',
      { token: admin.token },
    );
    const row = list.items.find((m) => m.phone === marketerPhone);
    expect(row).toBeTruthy();
    expect(row?.done).toBe(1); // فقط آزمون قبول‌شده
    expect(row?.quizAvg).toBe(100);
  });
});

describe('صفحه‌ی آزمون و پخش‌کننده', () => {
  it('پخش‌کننده‌ی یوتیوب و صوتی درست انتخاب می‌شوند', async () => {
    const { resolvePlayer } = await import('./pages/Learn');
    expect(resolvePlayer('https://www.youtube.com/watch?v=abc12345', 'video')).toEqual({
      type: 'youtube',
      id: 'abc12345',
    });
    expect(resolvePlayer('https://youtu.be/xyz98765', 'video')).toEqual({ type: 'youtube', id: 'xyz98765' });
    expect(resolvePlayer('https://www.aparat.com/v/AbCdEf', 'video')).toEqual({ type: 'aparat', id: 'AbCdEf' });
    expect(resolvePlayer('https://cdn.example.com/a.mp3', 'podcast')).toEqual({ type: 'audio' });
    expect(resolvePlayer('https://cdn.example.com/a.mp4', 'video')).toEqual({ type: 'video' });
    // آدرس ناشناخته → بر اساس نوع محتوا پخش‌کننده می‌گیرد
    expect(resolvePlayer('https://example.com/stream', 'video')).toEqual({ type: 'video' });
    expect(resolvePlayer('', 'podcast')).toEqual({ type: 'link' });
  });

  it('مسیر asset نسبی ساخته می‌شود (سازگار با GitHub Pages)', async () => {
    const { assetUrl } = await import('./components/SmartImage');
    expect(assetUrl('/catalog/brands/x/logo.png')).toBe('./catalog/brands/x/logo.png');
    expect(assetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(assetUrl('')).toBe('');
  });

  it('صفحه‌ی محصول برای محصول بدون محتوا، پیام مناسب می‌دهد', async () => {
    await loginPhone(ADMIN_PHONE);
    // محصولی که ادمین در تست قبل ساخت، محتوا دارد؛ پس یک محصول seed شده بدون محتوا را برمی‌داریم
    const admin = await api<{ token: string }>('/api/login', {
      method: 'POST',
      body: { phone: ADMIN_PHONE },
      auth: false,
    });
    const all = await api<{ items: { id: string; content_count: number; name: string }[] }>(
      '/api/admin/products',
      { token: admin.token },
    );
    const empty = all.items.find((p) => p.content_count === 0);
    expect(empty).toBeTruthy();

    goto(`#/products/${empty?.id}`);
    renderApp();

    expect(await screen.findByRole('heading', { name: 'سه مرحله‌ی آموزش این محصول' })).toBeInTheDocument();
    const notices = screen.getAllByText(/هنوز (پادکست|ویدئو|آزمون)/);
    expect(notices.length).toBeGreaterThanOrEqual(1);
    // سه بخش همیشه هست، حتی وقتی خالی است
    expect(within(screen.getByRole('heading', { name: 'سه مرحله‌ی آموزش این محصول' }).parentElement!).getAllByText(/پادکست|ویدئو|آزمون/).length).toBeGreaterThanOrEqual(3);
  });
});
