// پنل ادمین در مرورگر واقعی: ساخت برند، محصول، آزمون و محتوا،
// و سپس دیده‌شدن همان‌ها در اپ بازاریاب.
import { expect, test } from '@playwright/test';

const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '09120000001';
const stamp = String(Date.now()).slice(-6);

test.describe('پنل ادمین', () => {
  test('ادمین محتوا می‌سازد و بازاریاب همان را می‌بیند', async ({ page, browser }) => {
    const brandName = `برند تست ${stamp}`;
    const productName = `محصول تست ${stamp}`;
    const quizTitle = `آزمون تست ${stamp}`;

    // ---------- ادمین ----------
    await page.goto('/#/signup');
    await page.getByLabel('نام').fill('مدیر');
    await page.getByLabel('نام خانوادگی').fill('سیلانه سبز');
    await page.getByLabel('شماره موبایل').fill(ADMIN_PHONE);
    await page.getByRole('button', { name: /ثبت‌نام و ورود/ }).click();
    await expect(page).toHaveURL(/#\/brands/);

    await page.goto('/#/admin');
    await expect(page.getByRole('heading', { name: 'نمای کلی' })).toBeVisible();

    // ۱) آزمون
    await page.getByRole('button', { name: 'آزمون‌ها' }).click();
    await page.getByRole('button', { name: /ساخت آزمون/ }).click();
    await page.getByLabel('عنوان آزمون').fill(quizTitle);
    await page.getByLabel('متن سؤال ۱').fill('سؤال نمونه؟');
    await page.getByPlaceholder('گزینه‌ی ۱').first().fill('درست');
    await page.getByPlaceholder('گزینه‌ی ۲').first().fill('نادرست');
    await page.getByRole('button', { name: /ذخیره‌ی آزمون/ }).click();
    await expect(page.getByText(quizTitle).first()).toBeVisible();

    // ۲) برند
    await page.getByRole('button', { name: 'برندها' }).click();
    await page.getByRole('button', { name: /افزودن برند/ }).click();
    await page.getByLabel('نام برند').fill(brandName);
    await page.getByRole('button', { name: /^ذخیره$/ }).click();
    await expect(page.getByText(brandName).first()).toBeVisible();

    // ۳) محصول
    await page.getByRole('button', { name: 'محصولات' }).click();
    await page.getByRole('button', { name: /افزودن محصول/ }).click();
    await page.getByLabel('برند').selectOption({ label: brandName });
    await page.getByLabel('نام محصول').fill(productName);
    await page.getByRole('button', { name: /^ذخیره$/ }).click();
    await expect(page.getByText(productName).first()).toBeVisible();

    // ۴) سه محتوا برای همان محصول
    await page.getByRole('button', { name: 'محتوا' }).click();
    await page.getByLabel('برند').selectOption({ label: brandName });
    await page.getByLabel('محصول').selectOption({ label: productName });

    for (const [kind, title] of [
      ['پادکست (فایل صوتی)', 'پادکست نمونه'],
      ['ویدئو', 'ویدئو نمونه'],
    ] as const) {
      await page.getByRole('button', { name: /افزودن محتوا/ }).click();
      await page.getByLabel('نوع محتوا').selectOption({ label: kind });
      await page.getByLabel('عنوان').fill(title);
      await page
        .getByLabel('لینک')
        .fill(kind.startsWith('ویدئو') ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : 'https://example.com/a.mp3');
      await page.getByRole('button', { name: /^ذخیره$/ }).click();
      await expect(page.getByText(title).first()).toBeVisible();
    }

    await page.getByRole('button', { name: /افزودن محتوا/ }).click();
    await page.getByLabel('نوع محتوا').selectOption({ label: 'آزمون' });
    await page.getByLabel('عنوان').fill('آزمون نمونه');
    await page.getByLabel('آزمون').selectOption({ label: quizTitle });
    await page.getByRole('button', { name: /^ذخیره$/ }).click();
    await expect(page.getByText('آزمون نمونه').first()).toBeVisible();

    // ۵) گزارش بازاریاب‌ها باز می‌شود
    await page.getByRole('button', { name: 'بازاریاب‌ها' }).click();
    await expect(page.getByText('مدیر سیلانه سبز').first()).toBeVisible();

    // ---------- بازاریاب در یک مرورگر تازه ----------
    const ctx = await browser.newContext();
    const mPage = await ctx.newPage();
    const marketerPhone = `094${String(Date.now()).slice(-8)}`;

    await mPage.goto('/#/signup');
    await mPage.getByLabel('نام').fill('علی');
    await mPage.getByLabel('نام خانوادگی').fill('رضایی');
    await mPage.getByLabel('شماره موبایل').fill(marketerPhone);
    await mPage.getByRole('button', { name: /ثبت‌نام و ورود/ }).click();
    await expect(mPage).toHaveURL(/#\/brands/);

    await mPage.getByRole('link', { name: new RegExp(brandName) }).first().click();
    await mPage.getByText(productName).first().click();

    await expect(mPage.getByText('پادکست نمونه').first()).toBeVisible();
    await expect(mPage.getByText('ویدئو نمونه').first()).toBeVisible();
    await expect(mPage.getByText('آزمون نمونه').first()).toBeVisible();

    // ۶) بازاریاب به پنل ادمین راه ندارد
    await mPage.goto('/#/admin');
    await expect(mPage).toHaveURL(/#\/brands/);

    await ctx.close();
  });
});
