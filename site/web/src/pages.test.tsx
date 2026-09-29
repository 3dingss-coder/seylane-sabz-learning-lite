// =====================================================================
//  پوشش تک‌تک صفحه‌های سایت: پخش پادکست/ویدئو، جست‌وجو، حساب من،
//  تکرار آزمون، هر پنج تب پنل ادمین، و حالت خطا.
// =====================================================================
import { describe, expect, it, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter } from 'react-router-dom';
import { SessionProvider } from './store';
import App from './App';
import { api, setSession, type User } from './api';

const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '09120000001';
const digits = String(Date.now()).slice(-9);
const tag = digits.slice(-6);

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
async function loginAs(phone: string) {
  const res = await api<{ token: string; user: User }>('/api/login', {
    method: 'POST',
    body: { phone },
    auth: false,
  });
  setSession(res.token, res.user);
}

// ---------- داده‌ی مشترک ----------
const brandName = `برند پوشش ${tag}`;
const productName = `محصول پوشش ${tag}`;
const quizTitle = `آزمون پوشش ${tag}`;
let productId = '';
let podcastId = '';
let videoId = '';
let quizContentId = '';
let adminToken = '';

beforeAll(async () => {
  const admin = await api<{ token: string }>('/api/signup', {
    method: 'POST',
    body: { firstName: 'مدیر', lastName: 'پوشش', phone: ADMIN_PHONE },
    auth: false,
  });
  adminToken = admin.token;

  const quiz = await api<{ id: string }>('/api/admin/quizzes', {
    method: 'POST',
    token: adminToken,
    body: {
      title: quizTitle,
      passScore: 50,
      questions: [
        { q: 'دو به‌علاوه‌ی دو؟', options: ['سه', 'چهار', 'پنج'], answer: 1 },
        { q: 'پایتخت فرانسه؟', options: ['لندن', 'پاریس'], answer: 1 },
      ],
    },
  });
  const brand = await api<{ id: string }>('/api/admin/brands', {
    method: 'POST',
    token: adminToken,
    body: { name: brandName, nameEn: 'Cover', sortOrder: 98 },
  });
  const product = await api<{ id: string }>('/api/admin/products', {
    method: 'POST',
    token: adminToken,
    body: { brandId: brand.id, name: productName, code: `CV-${tag}`, category: 'پوشش تست' },
  });
  productId = product.id;

  const podcast = await api<{ id: string }>('/api/admin/contents', {
    method: 'POST',
    token: adminToken,
    body: { productId, kind: 'podcast', title: 'پادکست پوشش', url: 'https://example.com/cover.mp3', durationSec: 125 },
  });
  const video = await api<{ id: string }>('/api/admin/contents', {
    method: 'POST',
    token: adminToken,
    body: {
      productId,
      kind: 'video',
      title: 'ویدئو پوشش',
      url: 'https://www.youtube.com/watch?v=zzzzzzzzzzz',
    },
  });
  const quizC = await api<{ id: string }>('/api/admin/contents', {
    method: 'POST',
    token: adminToken,
    body: { productId, kind: 'quiz', title: 'آزمون پوشش', quizId: quiz.id },
  });
  podcastId = podcast.id;
  videoId = video.id;
  quizContentId = quizC.id;
});

describe('صفحه‌ی پخش (پادکست و ویدئو)', () => {
  it('پادکست: پخش‌کننده‌ی صوتی و مدت را نشان می‌دهد و با دکمه کامل می‌شود', async () => {
    await loginAs(ADMIN_PHONE);
    goto(`#/learn/${encodeURIComponent(podcastId)}`);
    mountApp();
    const user = userEvent.setup();

    expect(await screen.findByText('پادکست پوشش', {}, { timeout: 10_000 })).toBeInTheDocument();
    // ۱۲۵ ثانیه = ۲ دقیقه و ۵ ثانیه → «۲ دقیقه»
    expect(screen.getByText(/۲ دقیقه/)).toBeInTheDocument();
    expect(document.querySelector('audio')).not.toBeNull();
    expect(document.querySelector('audio')?.getAttribute('controls')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /پادکست را گوش دادم/ }));
    expect(await screen.findByText(/کامل‌شده ثبت شد/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'بازگشت به محصول' })).toBeInTheDocument();
  });

  it('ویدئو: لینک یوتیوب به iframe جاسازی تبدیل می‌شود', async () => {
    await loginAs(ADMIN_PHONE);
    goto(`#/learn/${encodeURIComponent(videoId)}`);
    mountApp();

    expect(await screen.findByText('ویدئو پوشش', {}, { timeout: 10_000 })).toBeInTheDocument();
    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toContain('youtube-nocookie.com/embed/zzzzzzzzzzz');
    // پخش‌کننده‌ی بومی ویدئو نباید برای لینک یوتیوب رندر شود
    expect(document.querySelector('video')).toBeNull();
  });

  it('صفحه‌ی محتوای ناموجود، پیام خطا با دکمه‌ی تلاش دوباره می‌دهد', async () => {
    await loginAs(ADMIN_PHONE);
    goto('#/learn/not-a-real-content');
    mountApp();
    expect(await screen.findByText('محتوا پیدا نشد.', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
  });
});

describe('صفحه‌ی برند و جست‌وجو', () => {
  it('جست‌وجو محصولات را فیلتر می‌کند', async () => {
    await loginAs(ADMIN_PHONE);
    const brands = await api<{ brands: { id: string; name: string }[] }>('/api/catalog', { token: adminToken });
    const brand = brands.brands.find((b) => b.name === brandName);
    expect(brand).toBeTruthy();

    goto(`#/brands/${encodeURIComponent(brand!.id)}`);
    mountApp();
    const user = userEvent.setup();

    expect(await screen.findByText(productName, {}, { timeout: 10_000 })).toBeInTheDocument();

    const search = screen.getByLabelText('جست‌وجوی محصول');
    await user.type(search, 'چیزی که وجود ندارد');
    expect(await screen.findByText(/محصولی با این نام پیدا نشد/)).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, productName);
    expect(await screen.findByText(productName)).toBeInTheDocument();
  });
});

describe('حساب من', () => {
  it('آمار و دکمه‌ی خروج را نشان می‌دهد', async () => {
    await loginAs(ADMIN_PHONE);
    goto('#/me');
    mountApp();

    expect(await screen.findByText('محتوای کامل‌شده', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText('کل محتواها')).toBeInTheDocument();
    expect(screen.getByText('آزمون داده‌شده')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /خروج از حساب/ })).toBeInTheDocument();
  });
});

describe('آزمون', () => {
  it('پاسخ غلط → رد، سپس تکرار و قبولی', async () => {
    await loginAs(ADMIN_PHONE);
    goto(`#/quiz/${encodeURIComponent(quizContentId)}`);
    mountApp();
    const user = userEvent.setup();

    // سؤال اول — پاسخ غلط
    expect(await screen.findByText('دو به‌علاوه‌ی دو؟', {}, { timeout: 10_000 })).toBeInTheDocument();
    await user.click(screen.getByText('سه'));
    await user.click(screen.getByRole('button', { name: /سؤال بعدی/ }));

    // سؤال دوم — پاسخ غلط
    expect(await screen.findByText('پایتخت فرانسه؟')).toBeInTheDocument();
    await user.click(screen.getByText('لندن'));
    await user.click(screen.getByRole('button', { name: /ثبت و دیدن نتیجه/ }));

    expect(await screen.findByText('قبول نشدید')).toBeInTheDocument();
    expect(screen.getByText('۰٪')).toBeInTheDocument();

    // تکرار
    await user.click(screen.getByRole('button', { name: /دوباره آزمون می‌دهم/ }));
    expect(await screen.findByText('دو به‌علاوه‌ی دو؟')).toBeInTheDocument();

    await user.click(screen.getByText('چهار'));
    await user.click(screen.getByRole('button', { name: /سؤال بعدی/ }));
    await user.click(screen.getByText('پاریس'));
    await user.click(screen.getByRole('button', { name: /ثبت و دیدن نتیجه/ }));

    expect(await screen.findByText('قبول شدید، آفرین!')).toBeInTheDocument();
    expect(screen.getByText('۱۰۰٪')).toBeInTheDocument();
    // مرور پاسخ‌ها باید پاسخ درست را علامت بزند
    expect(screen.getAllByText('پاسخ درست').length).toBe(2);
  });

  it('بدون انتخاب گزینه، دکمه‌ی «سؤال بعدی» غیرفعال است', async () => {
    await loginAs(ADMIN_PHONE);
    goto(`#/quiz/${encodeURIComponent(quizContentId)}`);
    mountApp();

    expect(await screen.findByText('دو به‌علاوه‌ی دو؟', {}, { timeout: 10_000 })).toBeInTheDocument();
    const next = screen.getByRole('button', { name: /سؤال بعدی/ });
    expect(next).toBeDisabled();
    expect(screen.getByText(/یک گزینه را انتخاب کنید/)).toBeInTheDocument();
  });
});

describe('پنل ادمین — هر پنج تب', () => {
  it('همه‌ی تب‌ها بدون خطا باز می‌شوند', async () => {
    await loginAs(ADMIN_PHONE);
    goto('#/admin');
    mountApp();
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'نمای کلی' }, { timeout: 10_000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'بازاریاب‌ها' }));
    expect(await screen.findByRole('button', { name: 'خروجی اکسل' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'برندها' }));
    expect(await screen.findByRole('button', { name: /افزودن برند/ })).toBeInTheDocument();
    expect(await screen.findByText(brandName)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'محصولات' }));
    expect(await screen.findByRole('button', { name: /افزودن محصول/ })).toBeInTheDocument();
    expect(await screen.findByText(productName, {}, { timeout: 10_000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'محتوا' }));
    expect(await screen.findByRole('button', { name: /افزودن محتوا/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'آزمون‌ها' }));
    expect(await screen.findByRole('button', { name: /ساخت آزمون/ })).toBeInTheDocument();
    expect(await screen.findByText(quizTitle)).toBeInTheDocument();
  });

  it('فیلتر برند در تب محصولات کار می‌کند', async () => {
    await loginAs(ADMIN_PHONE);
    goto('#/admin');
    mountApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'محصولات' }, { timeout: 10_000 }));
    await screen.findByRole('button', { name: /افزودن محصول/ });

    // userEvent با «value» یا خود المان option کار می‌کند، نه label
    const brandFilter = screen.getByLabelText('فیلتر برند') as HTMLSelectElement;
    // فهرست برندها async بارگذاری می‌شود، پس صبر می‌کنیم تا گزینه ظاهر شود
    const option = await within(brandFilter).findByRole('option', { name: brandName }, { timeout: 10_000 });
    await user.selectOptions(brandFilter, option);

    // فقط محصول همان برند باید بماند
    expect(await screen.findByText(productName, {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`کد CV-${tag}`))).toBeInTheDocument();
  });

  it('ساخت آزمون با ویرایشگر سؤال در رابط کاربری کار می‌کند', async () => {
    await loginAs(ADMIN_PHONE);
    goto('#/admin');
    mountApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'آزمون‌ها' }, { timeout: 10_000 }));
    await user.click(await screen.findByRole('button', { name: /ساخت آزمون/ }));

    const title = `آزمون رابط ${tag}`;
    await user.type(screen.getByLabelText('عنوان آزمون'), title);
    await user.type(screen.getByLabelText('متن سؤال ۱'), 'سؤال رابط کاربری؟');
    await user.type(screen.getByPlaceholderText('گزینه‌ی ۱'), 'بله');
    await user.type(screen.getByPlaceholderText('گزینه‌ی ۲'), 'خیر');
    await user.click(screen.getByRole('button', { name: /ذخیره‌ی آزمون/ }));

    expect(await screen.findByText(title, {}, { timeout: 10_000 })).toBeInTheDocument();
  });

  it('حذف با تأیید دومرحله‌ای انجام می‌شود', async () => {
    await loginAs(ADMIN_PHONE);
    goto('#/admin');
    mountApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'برندها' }, { timeout: 10_000 }));
    const row = (await screen.findByText(brandName)).closest('li')!;

    // کلیک اول فقط مسلح می‌کند
    await user.click(within(row as HTMLElement).getByRole('button', { name: `حذف ${brandName}` }));
    expect(within(row as HTMLElement).getByRole('button', { name: 'بی‌خیال' })).toBeInTheDocument();
    expect(await screen.findByText(brandName)).toBeInTheDocument();

    // «بی‌خیال» برمی‌گرداند
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'بی‌خیال' }));
    expect(await screen.findByText(brandName)).toBeInTheDocument();
  });
});
