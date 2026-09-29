// =====================================================================
//  تست یکپارچگی — کل جریان واقعی را روی Worker در حال اجرا می‌زند.
//  اجرا:  npm run dev  (در ترمینال دیگر)  سپس  node test/e2e.mjs
//  یا:    BASE_URL=http://127.0.0.1:8787 node test/e2e.mjs
// =====================================================================
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';

let passed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` → ${detail}` : ''}`);
    console.log(`  ✘ ${name}${detail ? ` → ${detail}` : ''}`);
  }
}

async function api(path, { method = 'GET', token, body, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) {
    // Response.text() طبق spec یک BOM ابتدای رشته را حذف می‌کند؛ برای بررسی BOM بایت خام لازم است.
    const buf = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, text: new TextDecoder().decode(buf), bytes: buf, headers: res.headers };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* پاسخ غیر JSON */
  }
  return { status: res.status, data };
}

const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '09120000001';
const MARKETER_PHONE = `093${String(Date.now()).slice(-8)}`;

async function main() {
  console.log(`\n▸ BASE_URL = ${BASE}\n`);

  // ---------- ۱. سلامت ----------
  console.log('[۱] سلامت سرویس و اتصال D1');
  const health = await api('/api/health');
  check('GET /api/health → 200', health.status === 200, JSON.stringify(health.data));
  check('اتصال D1 برقرار است (ok:true)', health.data?.ok === true);

  // ---------- ۲. ورود ادمین ----------
  console.log('\n[۲] ورود ادمین');
  const adminSignup = await api('/api/signup', {
    method: 'POST',
    body: { firstName: 'مدیر', lastName: 'سیلانه سبز', phone: ADMIN_PHONE },
  });
  check('ثبت‌نام ادمین موفق', adminSignup.status === 200 || adminSignup.status === 201, String(adminSignup.status));
  check('نقش ادمین درست است', adminSignup.data?.user?.role === 'admin', JSON.stringify(adminSignup.data?.user));
  const adminToken = adminSignup.data?.token;
  check('توکن صادر شد', typeof adminToken === 'string' && adminToken.includes('.'));

  // ---------- ۳. ثبت‌نام و ورود بازاریاب ----------
  console.log('\n[۳] ثبت‌نام و ورود بازاریاب');
  const badName = await api('/api/signup', { method: 'POST', body: { firstName: 'ا', lastName: '', phone: '09121234567' } });
  check('نام ناقص رد می‌شود (400)', badName.status === 400, String(badName.status));

  const badPhone = await api('/api/signup', { method: 'POST', body: { firstName: 'سارا', lastName: 'احمدی', phone: '12345' } });
  check('شماره‌ی نامعتبر رد می‌شود (400)', badPhone.status === 400, String(badPhone.status));

  const signup = await api('/api/signup', {
    method: 'POST',
    body: { firstName: 'سارا', lastName: 'احمدی', phone: MARKETER_PHONE },
  });
  check('ثبت‌نام بازاریاب → 201', signup.status === 201, String(signup.status));
  check('نقش پیش‌فرض marketer است', signup.data?.user?.role === 'marketer');
  const marketerId = signup.data?.user?.id;

  // ورود با ارقام فارسی و فرمت +98
  const faPhone = '۰' + MARKETER_PHONE.slice(1).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const loginFa = await api('/api/login', { method: 'POST', body: { phone: faPhone } });
  check('ورود با ارقام فارسی کار می‌کند', loginFa.status === 200 && loginFa.data?.user?.id === marketerId, String(loginFa.status));

  const loginIntl = await api('/api/login', { method: 'POST', body: { phone: `+98${MARKETER_PHONE.slice(1)}` } });
  check('ورود با فرمت +98 کار می‌کند', loginIntl.status === 200 && loginIntl.data?.user?.id === marketerId);

  const token = loginFa.data?.token;
  check('توکن بازاریاب صادر شد', typeof token === 'string');

  const notReg = await api('/api/login', { method: 'POST', body: { phone: '09110000099' } });
  check('شماره‌ی ثبت‌نشده → 404 و پیام راهنما', notReg.status === 404 && !!notReg.data?.message, JSON.stringify(notReg.data));

  // ---------- ۴. دسترسی‌ها ----------
  console.log('\n[۴] کنترل دسترسی');
  const noToken = await api('/api/catalog');
  check('بدون توکن → 401', noToken.status === 401, String(noToken.status));
  const badToken = await api('/api/catalog', { token: 'garbage.token' });
  check('توکن خراب → 401', badToken.status === 401, String(badToken.status));
  const tampered = await api('/api/catalog', { token: token.slice(0, -2) + 'xx' });
  check('توکن دستکاری‌شده → 401', tampered.status === 401, String(tampered.status));
  const forbidden = await api('/api/admin/overview', { token });
  check('بازاریاب به پنل ادمین دسترسی ندارد (403)', forbidden.status === 403, String(forbidden.status));

  // ---------- ۵. کاتالوگ ----------
  console.log('\n[۵] کاتالوگ برندها و محصولات');
  const catalog = await api('/api/catalog', { token });
  check('GET /api/catalog → 200', catalog.status === 200);
  const brands = catalog.data?.brands ?? [];
  check('۱۲ برند seed شده است', brands.length === 12, `تعداد=${brands.length}`);
  const totalProducts = brands.reduce((s, b) => s + b.productCount, 0);
  check('۲۳۸ محصول seed شده است', totalProducts === 238, `تعداد=${totalProducts}`);
  const firstBrand = brands[0];
  check('هر برند درصد پیشرفت دارد', typeof firstBrand?.percent === 'number');

  const brandPage = await api(`/api/brands/${firstBrand.id}`, { token });
  check('صفحه‌ی برند محصولات را برمی‌گرداند', brandPage.status === 200 && brandPage.data?.products?.length > 0);
  const product = brandPage.data.products[0];
  check('محصول تصویر دارد', typeof product.image === 'string' && product.image.startsWith('/catalog/'), product.image);
  const missingBrand = await api('/api/brands/nope-not-real', { token });
  check('برند ناموجود → 404', missingBrand.status === 404);

  // ---------- ۶. ادمین: ساخت آزمون و محتوا ----------
  console.log('\n[۶] ادمین: ساخت آزمون، پادکست، ویدئو');
  const badQuiz = await api('/api/admin/quizzes', { method: 'POST', token: adminToken, body: { title: '', questions: [] } });
  check('آزمون بدون عنوان/سؤال رد می‌شود', badQuiz.status === 400, String(badQuiz.status));
  const badAnswer = await api('/api/admin/quizzes', {
    method: 'POST',
    token: adminToken,
    body: { title: 'آزمون بد', questions: [{ q: 'س', options: ['a', 'b'], answer: 9 }] },
  });
  check('پاسخ خارج از محدوده رد می‌شود', badAnswer.status === 400, String(badAnswer.status));

  const quizRes = await api('/api/admin/quizzes', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `آزمون ${product.name}`,
      passScore: 70,
      questions: [
        { q: 'سؤال یک', options: ['گزینه ۱', 'گزینه ۲', 'گزینه ۳'], answer: 1 },
        { q: 'سؤال دو', options: ['الف', 'ب'], answer: 0 },
      ],
    },
  });
  check('آزمون ساخته شد → 201', quizRes.status === 201, JSON.stringify(quizRes.data));
  const quizId = quizRes.data?.id;

  const mk = async (kind, extra) =>
    api('/api/admin/contents', {
      method: 'POST',
      token: adminToken,
      body: { productId: product.id, kind, title: `${kind}-${Date.now()}`, ...extra },
    });

  // لیست‌های بدون فیلتر ادمین (رگرسیون: قبلاً .all() جا افتاده بود و کرش می‌کرد)
  const allProducts = await api('/api/admin/products', { token: adminToken });
  check('لیست همه‌ی محصولات (بدون فیلتر) → 200', allProducts.status === 200 && Array.isArray(allProducts.data?.items), String(allProducts.status));
  check('لیست محصولات ادمین ۲۳۸ ردیف دارد', allProducts.data?.items?.length === 238, String(allProducts.data?.items?.length));
  const filteredProducts = await api(`/api/admin/products?brand=${firstBrand.id}`, { token: adminToken });
  check('فیلتر محصولات بر اساس برند کار می‌کند', filteredProducts.data?.items?.length === firstBrand.productCount, String(filteredProducts.data?.items?.length));
  const allContents = await api('/api/admin/contents', { token: adminToken });
  check('لیست همه‌ی محتواها (بدون فیلتر) → 200', allContents.status === 200 && Array.isArray(allContents.data?.items), String(allContents.status));
  const allQuizzes = await api('/api/admin/quizzes', { token: adminToken });
  check('لیست آزمون‌ها سؤال‌ها را برمی‌گرداند', allQuizzes.status === 200 && allQuizzes.data?.items?.length >= 1);
  const allBrands = await api('/api/admin/brands', { token: adminToken });
  check('لیست برندها با شمارش محصولات', allBrands.status === 200 && allBrands.data?.items?.[0]?.product_count > 0);

  const noUrl = await mk('video', {});
  check('ویدئو بدون لینک رد می‌شود', noUrl.status === 400, String(noUrl.status));
  const noQuiz = await mk('quiz', {});
  check('آزمون بدون انتخاب quiz رد می‌شود', noQuiz.status === 400, String(noQuiz.status));

  const podcast = await mk('podcast', { url: 'https://example.com/a.mp3', durationSec: 120 });
  const video = await mk('video', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  const quizContent = await mk('quiz', { quizId });
  check('پادکست ساخته شد', podcast.status === 201, JSON.stringify(podcast.data));
  check('ویدئو ساخته شد', video.status === 201, JSON.stringify(video.data));
  check('آزمون به محصول وصل شد', quizContent.status === 201, JSON.stringify(quizContent.data));

  // ---------- ۷. صفحه‌ی محصول: سه گزینه ----------
  console.log('\n[۷] صفحه‌ی محصول — سه گزینه');
  const detail = await api(`/api/products/${product.id}`, { token });
  check('GET /api/products/:id → 200', detail.status === 200);
  const kinds = (detail.data?.items ?? []).map((i) => i.kind).sort();
  check('دقیقاً سه گزینه: podcast, quiz, video', kinds.join(',') === 'podcast,quiz,video', kinds.join(','));
  check('در ابتدا هیچ‌کدام کامل نشده', detail.data?.done === 0 && detail.data?.total === 3);

  // ---------- ۸. نشتی پاسخ آزمون ----------
  console.log('\n[۸] امنیت: پاسخ آزمون به کلاینت نمی‌رسد');
  const quizView = await api(`/api/contents/${quizContent.data.id}`, { token });
  check('آزمون برگردانده شد', quizView.status === 200 && !!quizView.data?.quiz);
  const leaked = JSON.stringify(quizView.data?.quiz ?? {}).includes('"answer"');
  check('فیلد answer در پاسخ وجود ندارد', !leaked, leaked ? 'نشتی!' : '');
  check('سؤال‌ها با گزینه‌ها ارسال شده‌اند', quizView.data?.quiz?.questions?.[0]?.options?.length === 3);

  // ---------- ۹. پیشرفت و آزمون ----------
  console.log('\n[۹] ثبت پیشرفت و تصحیح آزمون');
  const noContent = await api('/api/progress', { method: 'POST', token, body: { contentId: 'fake' } });
  check('محتوای ناموجود رد می‌شود', noContent.status === 400);

  const prog = await api('/api/progress', {
    method: 'POST',
    token,
    body: { contentId: podcast.data.id, status: 'completed', percent: 100 },
  });
  check('تکمیل پادکست ثبت شد', prog.status === 200 && prog.data?.status === 'completed');

  const half = await api('/api/progress', {
    method: 'POST',
    token,
    body: { contentId: video.data.id, status: 'started', percent: 40 },
  });
  check('پیشرفت نسبی ویدئو ثبت شد (40٪)', half.status === 200 && half.data?.percent === 40, JSON.stringify(half.data));

  const wrongQuiz = await api('/api/quiz-submit', {
    method: 'POST',
    token,
    body: { contentId: quizContent.data.id, answers: [0, 1] },
  });
  check('آزمون با پاسخ غلط → رد (score 0)', wrongQuiz.status === 200 && wrongQuiz.data?.passed === false && wrongQuiz.data?.score === 0, JSON.stringify(wrongQuiz.data));
  check('مرور پاسخ‌ها برگردانده می‌شود', Array.isArray(wrongQuiz.data?.review) && wrongQuiz.data.review.length === 2);

  const rightQuiz = await api('/api/quiz-submit', {
    method: 'POST',
    token,
    body: { contentId: quizContent.data.id, answers: [1, 0] },
  });
  check('آزمون با پاسخ درست → قبول (score 100)', rightQuiz.data?.passed === true && rightQuiz.data?.score === 100, JSON.stringify(rightQuiz.data));

  await api('/api/progress', { method: 'POST', token, body: { contentId: video.data.id, status: 'completed', percent: 100 } });

  const done = await api(`/api/products/${product.id}`, { token });
  check('محصول ۳ از ۳ تکمیل شد', done.data?.done === 3 && done.data?.total === 3, `${done.data?.done}/${done.data?.total}`);

  const brandAfter = await api(`/api/brands/${firstBrand.id}`, { token });
  const pAfter = brandAfter.data.products.find((p) => p.id === product.id);
  check('درصد محصول در لیست برند ۱۰۰ شد', pAfter?.percent === 100, String(pAfter?.percent));

  const catAfter = await api('/api/catalog', { token });
  const bAfter = catAfter.data.brands.find((b) => b.id === firstBrand.id);
  check('پیشرفت برند به‌روز شد', bAfter.done === 3 && bAfter.percent > 0, `${bAfter.done}/${bAfter.total}`);

  const me = await api('/api/me', { token });
  check('GET /api/me آمار را برمی‌گرداند', me.data?.stats?.done === 3 && me.data?.stats?.quizzes === 2, JSON.stringify(me.data?.stats));

  // ---------- ۱۰. گزارش ادمین ----------
  console.log('\n[۱۰] گزارش ادمین از وضعیت بازاریاب‌ها');
  const ov = await api('/api/admin/overview', { token: adminToken });
  check('overview → 200', ov.status === 200);
  check('شمارش برندها = ۱۲', ov.data?.brands === 12, String(ov.data?.brands));
  check('شمارش محصولات = ۲۳۸', ov.data?.products === 238, String(ov.data?.products));

  const marketers = await api('/api/admin/marketers', { token: adminToken });
  const row = (marketers.data?.items ?? []).find((m) => m.id === marketerId);
  check('بازاریاب در گزارش هست', !!row);
  check('پیشرفت بازاریاب ۳ است', row?.done === 3, String(row?.done));
  check('درصد پیشرفت محاسبه شده', row?.percent > 0, String(row?.percent));
  check('میانگین آزمون = ۵۰', row?.quizAvg === 50, String(row?.quizAvg));
  check('آخرین فعالیت ثبت شده', !!row?.lastActivity);

  const detailRow = await api(`/api/admin/marketers/${marketerId}`, { token: adminToken });
  check('جزئیات بازاریاب برگردانده شد', detailRow.status === 200);
  const completed = (detailRow.data?.items ?? []).filter((i) => i.status === 'completed');
  check('۳ آیتم تکمیل‌شده در جزئیات', completed.length === 3, String(completed.length));
  check('۲ رکورد آزمون در جزئیات', detailRow.data?.quizzes?.length === 2, String(detailRow.data?.quizzes?.length));

  const csv = await api('/api/admin/export.csv', { token: adminToken, raw: true });
  check('خروجی CSV → 200', csv.status === 200);
  check(
    'CSV با BOM شروع می‌شود (فارسی در Excel)',
    csv.bytes[0] === 0xef && csv.bytes[1] === 0xbb && csv.bytes[2] === 0xbf,
    `${csv.bytes[0]?.toString(16)} ${csv.bytes[1]?.toString(16)} ${csv.bytes[2]?.toString(16)}`,
  );
  check('CSV شامل بازاریاب تست است', csv.text.includes(MARKETER_PHONE));

  // ---------- ۱۱. CORS ----------
  console.log('\n[۱۱] CORS برای GitHub Pages');
  const pre = await fetch(`${BASE}/api/catalog`, { method: 'OPTIONS', headers: { Origin: 'https://example.github.io' } });
  check('preflight → 204', pre.status === 204, String(pre.status));
  check('هدر Access-Control-Allow-Origin ست شده', !!pre.headers.get('access-control-allow-origin'), String(pre.headers.get('access-control-allow-origin')));
  const get = await fetch(`${BASE}/api/health`, { headers: { Origin: 'https://example.github.io' } });
  check('پاسخ GET هم هدر CORS دارد', !!get.headers.get('access-control-allow-origin'));

  // ---------- ۱۲. حذف آبشاری ----------
  console.log('\n[۱۲] حذف آبشاری (بدون رکورد یتیم)');
  const delContent = await api(`/api/admin/contents/${podcast.data.id}`, { method: 'DELETE', token: adminToken });
  check('حذف محتوا → 200', delContent.status === 200);
  const afterDel = await api(`/api/products/${product.id}`, { token });
  check('محتوای حذف‌شده دیگر نیست', !(afterDel.data?.items ?? []).some((i) => i.id === podcast.data.id));
  const orphan = await api(`/api/admin/marketers/${marketerId}`, { token: adminToken });
  check('رکورد پیشرفت یتیم نمانده', !(orphan.data?.items ?? []).some((i) => i.content_id === podcast.data.id));

  const delBrand = await api(`/api/admin/brands/${firstBrand.id}`, { method: 'DELETE', token: adminToken });
  check('حذف برند → 200', delBrand.status === 200);
  const catFinal = await api('/api/catalog', { token });
  check('برند از لیست حذف شد', catFinal.data.brands.length === 11, String(catFinal.data.brands.length));
  const goneProduct = await api(`/api/products/${product.id}`, { token });
  check('محصولات برند هم آبشاری حذف شدند', goneProduct.status === 404, String(goneProduct.status));

  // ---------- خلاصه ----------
  console.log(`\n${'='.repeat(56)}`);
  if (failures.length === 0) {
    console.log(`✅ همه‌ی ${passed} بررسی موفق بود.`);
  } else {
    console.log(`❌ ${failures.length} شکست از ${passed + failures.length} بررسی:`);
    for (const f of failures) console.log(`   - ${f}`);
  }
  console.log('='.repeat(56));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n💥 خطای غیرمنتظره:', err);
  process.exit(1);
});
