// سفر کامل بازاریاب در مرورگر واقعی، روی موبایل و دسکتاپ.
import { expect, test, type Page } from '@playwright/test';

const phone = `093${String(Date.now()).slice(-8)}`;

/** هیچ خطای کنسولی نباید رد شود — نشانه‌ی باگ روی دیوایس واقعی است. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** چک می‌کند صفحه اسکرول افقی نداشته باشد (باگ رایج RTL در موبایل). */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'صفحه نباید اسکرول افقی داشته باشد').toBeLessThanOrEqual(1);
}

test.describe('سفر بازاریاب', () => {
  test('ثبت‌نام، دیدن برندها، محصولات و سه گزینه‌ی آموزش', async ({ page }) => {
    const errors = watchConsole(page);

    // ۱) صفحه‌ی اول
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'آموزش سیلانه‌سبز' })).toBeVisible();
    await expect(page.getByRole('link', { name: /ورود با شماره موبایل/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /ثبت‌نام می‌کنم/ })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // ۲) ثبت‌نام
    await page.getByRole('link', { name: /ثبت‌نام می‌کنم/ }).click();
    await page.getByLabel('نام').fill('سارا');
    await page.getByLabel('نام خانوادگی').fill('احمدی');
    await page.getByLabel('شماره موبایل').fill(phone);
    await page.getByRole('button', { name: /ثبت‌نام و ورود/ }).click();

    // ۳) لیست برندها
    await expect(page).toHaveURL(/#\/brands/);
    await expect(page.getByText('پیشرفت کلی آموزش شما')).toBeVisible();
    await expect(page.getByRole('link', { name: /کامان/ }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);

    // ۴) محصولات یک برند
    await page.getByRole('link', { name: /کامان/ }).first().click();
    await expect(page.getByLabel('جست‌وجوی محصول')).toBeVisible();
    const firstProduct = page.locator('a[href^="#/products/"]').first();
    await expect(firstProduct).toBeVisible();
    const productName = (await firstProduct.innerText()).split('\n')[0]?.trim() ?? '';
    await firstProduct.click();

    // ۵) صفحه‌ی محصول — دقیقاً سه گزینه
    await expect(page.getByRole('heading', { name: 'سه مرحله‌ی آموزش این محصول' })).toBeVisible();
    for (const label of ['پادکست', 'ویدئو', 'آزمون']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    expect(productName.length).toBeGreaterThan(0);
    await expectNoHorizontalScroll(page);

    // ۶) حساب من
    await page.goto('/#/me');
    await expect(page.getByText('سارا احمدی')).toBeVisible();
    await expect(page.getByText(phone)).toBeVisible();

    // ۷) خروج و ورود دوباره فقط با شماره
    await page.getByRole('button', { name: /خروج از حساب/ }).click();
    await expect(page).toHaveURL(/#\/$/);
    await page.getByRole('link', { name: /ورود با شماره موبایل/ }).click();
    await page.getByLabel('شماره موبایل').fill(phone);
    await page.getByRole('button', { name: /^ورود$/ }).click();
    await expect(page).toHaveURL(/#\/brands/);

    expect(errors, `خطای کنسول: ${errors.join(' | ')}`).toEqual([]);
  });

  test('ورود با شماره‌ی ثبت‌نشده، راهنمای ثبت‌نام نشان می‌دهد', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel('شماره موبایل').fill('09110000099');
    await page.getByRole('button', { name: /^ورود$/ }).click();
    await expect(page.getByText('این شماره هنوز ثبت نشده است.')).toBeVisible();
    await expect(page.getByRole('link', { name: /ثبت‌نام با همین شماره/ })).toBeVisible();
  });

  test('شماره‌ی نامعتبر بلافاصله پیام می‌دهد', async ({ page }) => {
    await page.goto('/#/signup');
    await page.getByLabel('نام').fill('سارا');
    await page.getByLabel('نام خانوادگی').fill('احمدی');
    await page.getByLabel('شماره موبایل').fill('123');
    await page.getByRole('button', { name: /ثبت‌نام و ورود/ }).click();
    await expect(page.getByText(/شماره موبایل را کامل و درست وارد کنید/)).toBeVisible();
    await expect(page).toHaveURL(/#\/signup/);
  });

  test('بدون ورود، مستقیم به صفحه‌ی ورود می‌رود', async ({ page }) => {
    await page.goto('/#/brands');
    await expect(page).toHaveURL(/#\/login/);
  });
});
