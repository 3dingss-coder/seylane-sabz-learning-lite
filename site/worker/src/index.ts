// =====================================================================
//  سیلانه‌سبز لرنینگ — API روی Cloudflare Workers + D1
//  همه‌ی مسیرها زیر /api هستند. بدون هیچ کتابخانه‌ی خارجی.
// =====================================================================
import {
  type Env,
  type SessionUser,
  adminPhones,
  roleFor,
  signToken,
  upsertUser,
  verifyToken,
} from './auth';
import { bearer, corsHeaders, fail, json, pathSegments, readJson, sessionCookie } from './http';
import { normalizePhone, nowIso } from './util';
import {
  contentDetail,
  listBrands,
  listProducts,
  productDetail,
  safeQuestions,
} from './catalog';
import { gradeQuiz, saveProgress } from './learning';
import {
  adminBrands,
  adminContents,
  adminProducts,
  adminQuizzes,
  buildCsv,
  createBrand,
  createContent,
  createProduct,
  createQuiz,
  listMarketers,
  marketerDetail,
  overview,
  softDelete,
  updateBrand,
  updateContent,
  updateProduct,
  updateQuiz,
} from './admin';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const cors = corsHeaders(request, env);
    try {
      return await route(request, env, url, cors);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.waitUntil(Promise.resolve());
      console.error('[worker] unhandled', message);
      return fail('SERVER_ERROR', 'خطای سرور. لطفاً دوباره تلاش کنید.', 500, cors);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, url: URL, cors: HeadersInit): Promise<Response> {
  const method = request.method;

  // پاسخ ورود/ثبت‌نام: توکن را هم در بدنه و هم در کوکی می‌دهیم تا اگر
  // پروکسیِ میانی هدر Authorization را حذف کرد، کوکی جلسه را نگه دارد.
  const authResponse = (payload: Record<string, unknown>, status: number): Response =>
    json(payload, status, { ...cors, 'Set-Cookie': sessionCookie(String(payload.token ?? '')) });

  // سلامت سرویس
  if (url.pathname === '/api/health') {
    const ok = await env.DB.prepare('SELECT 1 AS one').first<{ one: number }>();
    return json({ ok: ok?.one === 1, time: nowIso() }, 200, cors);
  }

  // ------------------------------------------------------- ثبت‌نام
  if (url.pathname === '/api/signup' && method === 'POST') {
    const body = await readJson<{ firstName?: string; lastName?: string; phone?: string }>(request);
    const firstName = String(body.firstName ?? '').trim().replace(/\s+/g, ' ');
    const lastName = String(body.lastName ?? '').trim().replace(/\s+/g, ' ');
    const phone = normalizePhone(body.phone);
    if (firstName.length < 2) return fail('BAD_NAME', 'نام را کامل وارد کنید.', 400, cors);
    if (lastName.length < 2) return fail('BAD_NAME', 'نام خانوادگی را کامل وارد کنید.', 400, cors);
    if (!phone) return fail('BAD_PHONE', 'شماره موبایل درست نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷', 400, cors);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE phone = ?1').bind(phone).first();
    if (existing) {
      // کاربر از قبل هست → مستقیم واردش می‌کنیم (تجربه‌ی بدون خطا برای کاربر تازه‌وارد).
      const user = await upsertUser(env, { firstName, lastName, phone });
      return authResponse({ token: await signToken(env, user), user: publicUser(user), alreadyRegistered: true }, 200);
    }
    const user = await upsertUser(env, { firstName, lastName, phone });
    return authResponse({ token: await signToken(env, user), user: publicUser(user) }, 201);
  }

  // ------------------------------------------------------- ورود
  if (url.pathname === '/api/login' && method === 'POST') {
    const body = await readJson<{ phone?: string; firstName?: string; lastName?: string }>(request);
    const phone = normalizePhone(body.phone);
    if (!phone) return fail('BAD_PHONE', 'شماره موبایل درست نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷', 400, cors);

    const row = await env.DB.prepare(
      'SELECT id, first_name, last_name, phone, role FROM users WHERE phone = ?1',
    )
      .bind(phone)
      .first<SessionUser>();

    if (!row) {
      // اگر نام و نام خانوادگی هم فرستاده شد، ثبت‌نام انجام می‌شود تا کاربر گیر نکند.
      const firstName = String(body.firstName ?? '').trim();
      const lastName = String(body.lastName ?? '').trim();
      if (firstName.length >= 2 && lastName.length >= 2) {
        const user = await upsertUser(env, { firstName, lastName, phone });
        return authResponse({ token: await signToken(env, user), user: publicUser(user), signedUp: true }, 201);
      }
      return fail('NOT_REGISTERED', 'این شماره ثبت نشده. اول ثبت‌نام کنید.', 404, cors);
    }

    const user: SessionUser = {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      role: roleFor(env, row.phone),
    };
    // اگر شماره در ADMIN_PHONE اضافه شده، نقشش را ارتقا می‌دهیم.
    if (user.role !== row.role) {
      await env.DB.prepare('UPDATE users SET role = ?1 WHERE id = ?2').bind(user.role, user.id).run();
    }
    return authResponse({ token: await signToken(env, user), user: publicUser(user) }, 200);
  }

  // ------------------------------------------------------- از اینجا به بعد توکن لازم است
  const claims = await verifyToken(env, bearer(request));
  if (!claims) {
    // لاگ تشخیصی: وقتی کاربر «جلسه تمام شد» می‌بیند، از این خطا معلوم می‌شود
    // آیا توکن اصلاً به سرور رسیده یا پروکسیِ میانی هدرش را حذف کرده است.
    const rawAuth = request.headers.get('Authorization');
    console.warn(
      `[auth] 401 token-missing-or-invalid path=${url.pathname}` +
        ` hasAuthHeader=${rawAuth !== null}` +
        ` authLen=${rawAuth?.length ?? 0}` +
        ` hasXAuth=${request.headers.get('X-Auth-Token') !== null}` +
        ` hasCookie=${request.headers.get('Cookie') !== null}` +
        ` origin=${request.headers.get('Origin') ?? '-'}`,
    );
    return fail('UNAUTHORIZED', 'لطفاً دوباره وارد شوید.', 401, cors);
  }

  const user = await env.DB.prepare(
    'SELECT id, first_name, last_name, phone, role FROM users WHERE id = ?1',
  )
    .bind(claims.id)
    .first<SessionUser>();
  if (!user) {
    console.warn(`[auth] 401 user-not-found path=${url.pathname} id=${claims.id}`);
    return fail('UNAUTHORIZED', 'حساب کاربری پیدا نشد.', 401, cors);
  }

  // ------------------------------------------------------- مسیرهای ادمین
  const adminSegs = pathSegments(url, '/api/admin');
  if (adminSegs.length > 0) {
    if (user.role !== 'admin') return fail('FORBIDDEN', 'دسترسی ادمین ندارید.', 403, cors);
    return adminRoute(request, env, adminSegs, cors);
  }

  const segs = pathSegments(url, '/api');

  // GET /api/me
  if (method === 'GET' && segs[0] === 'me') {
    const counts = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM contents) AS total,
         (SELECT COUNT(*) FROM progress WHERE user_id = ?1 AND status = 'completed') AS done,
         (SELECT COUNT(*) FROM quiz_results WHERE user_id = ?1) AS quizzes`,
    )
      .bind(user.id)
      .first<{ total: number; done: number; quizzes: number }>();
    return json({ user: publicUser(user), stats: counts }, 200, cors);
  }

  // GET /api/catalog
  if (method === 'GET' && segs[0] === 'catalog') {
    return json({ brands: await listBrands(env, user.id) }, 200, cors);
  }

  // GET /api/brands/:id
  if (method === 'GET' && segs[0] === 'brands' && segs[1]) {
    const data = await listProducts(env, segs[1], user.id);
    if (!data) return fail('NOT_FOUND', 'برند پیدا نشد.', 404, cors);
    return json(data, 200, cors);
  }

  // GET /api/products/:id
  if (method === 'GET' && segs[0] === 'products' && segs[1]) {
    const data = await productDetail(env, segs[1], user.id);
    if (!data) return fail('NOT_FOUND', 'محصول پیدا نشد.', 404, cors);
    return json(data, 200, cors);
  }

  // GET /api/contents/:id
  if (method === 'GET' && segs[0] === 'contents' && segs[1]) {
    const data = await contentDetail(env, segs[1]);
    if (!data) return fail('NOT_FOUND', 'محتوا پیدا نشد.', 404, cors);
    return json(data, 200, cors);
  }

  // POST /api/progress
  if (method === 'POST' && segs[0] === 'progress') {
    const body = await readJson<{ contentId?: string; percent?: number; status?: string }>(request);
    const res = await saveProgress(env, user, body);
    if (!res.ok) return fail(res.error, 'ثبت پیشرفت ناموفق بود.', 400, cors);
    return json(res, 200, cors);
  }

  // POST /api/quiz-submit
  if (method === 'POST' && segs[0] === 'quiz-submit') {
    const body = await readJson<{ contentId?: string; answers?: number[] }>(request);
    const res = await gradeQuiz(env, user, body);
    if (!res.ok) return fail(res.error, 'تصحیح آزمون ناموفق بود.', 400, cors);
    return json(res, 200, cors);
  }

  return fail('NOT_FOUND', 'مسیر پیدا نشد.', 404, cors);
}

// =====================================================================
//  مسیرهای ادمین
// =====================================================================
async function adminRoute(
  request: Request,
  env: Env,
  segs: string[],
  cors: HeadersInit,
): Promise<Response> {
  const method = request.method;
  const [resource, id] = segs as [string, string | undefined];
  const body = method === 'POST' || method === 'PATCH' || method === 'PUT'
    ? await readJson<Record<string, unknown>>(request)
    : {};

  const wrap = async (fn: () => Promise<unknown>) => {
    const res = (await fn()) as { error?: string } & Record<string, unknown>;
    if (res && typeof res === 'object' && 'error' in res && typeof res.error === 'string') {
      return fail('BAD_REQUEST', res.error, 400, cors);
    }
    return json(res, method === 'POST' ? 201 : 200, cors);
  };

  switch (resource) {
    case 'overview':
      return json(await overview(env), 200, cors);

    case 'brands':
      if (method === 'GET') return json({ items: await adminBrands(env) }, 200, cors);
      if (method === 'POST') return wrap(() => createBrand(env, body));
      if ((method === 'PATCH' || method === 'PUT') && id) return wrap(() => updateBrand(env, id, body));
      if (method === 'DELETE' && id) return json(await softDelete(env, 'brands', id, {} as never), 200, cors);
      break;

    case 'products':
      if (method === 'GET') {
        const brandId = url_param(request, 'brand');
        return json({ items: await adminProducts(env, brandId || undefined) }, 200, cors);
      }
      if (method === 'POST') return wrap(() => createProduct(env, body));
      if ((method === 'PATCH' || method === 'PUT') && id) return wrap(() => updateProduct(env, id, body));
      if (method === 'DELETE' && id) return json(await softDelete(env, 'products', id, {} as never), 200, cors);
      break;

    case 'quizzes':
      if (method === 'GET') return json({ items: await adminQuizzes(env) }, 200, cors);
      if (method === 'POST') return wrap(() => createQuiz(env, body));
      if ((method === 'PATCH' || method === 'PUT') && id) return wrap(() => updateQuiz(env, id, body));
      if (method === 'DELETE' && id) return json(await softDelete(env, 'quizzes', id, {} as never), 200, cors);
      break;

    case 'contents':
      if (method === 'GET') {
        const productId = url_param(request, 'product');
        return json({ items: await adminContents(env, productId || undefined) }, 200, cors);
      }
      if (method === 'POST') return wrap(() => createContent(env, body));
      if ((method === 'PATCH' || method === 'PUT') && id) return wrap(() => updateContent(env, id, body));
      if (method === 'DELETE' && id) return json(await softDelete(env, 'contents', id, {} as never), 200, cors);
      break;

    case 'marketers':
      if (method === 'GET' && !id) return json({ items: await listMarketers(env) }, 200, cors);
      if (method === 'GET' && id) {
        const data = await marketerDetail(env, id);
        if (!data) return fail('NOT_FOUND', 'بازاریاب پیدا نشد.', 404, cors);
        return json(data, 200, cors);
      }
      break;

    case 'export.csv': {
      const rows = await listMarketers(env);
      const csv = buildCsv([
        ['نام', 'نام خانوادگی', 'شماره تلفن', 'نقش', 'تاریخ ثبت‌نام', 'تکمیل‌شده', 'کل', 'درصد', 'میانگین آزمون', 'تعداد آزمون', 'آخرین فعالیت'],
        ...rows.map((r) => [
          String(r.firstName),
          String(r.lastName),
          String(r.phone),
          r.role === 'admin' ? 'ادمین' : 'بازاریاب',
          String(r.createdAt ?? ''),
          r.done,
          r.total,
          r.percent,
          r.quizAvg ?? '',
          r.quizCount,
          String(r.lastActivity ?? ''),
        ]),
      ]);
      return new Response(csv, {
        status: 200,
        headers: {
          ...Object.fromEntries(new Headers(cors).entries()),
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="marketers.csv"',
        },
      });
    }

    case 'me':
      return json({ user: publicUser((await me(env, request)) as SessionUser), adminPhones: adminPhones(env) }, 200, cors);
  }

  return fail('NOT_FOUND', 'مسیر ادمین پیدا نشد.', 404, cors);
}

// =====================================================================
function url_param(request: Request, key: string): string {
  return new URL(request.url).searchParams.get(key) ?? '';
}

async function me(env: Env, request: Request) {
  const claims = await verifyToken(env, bearer(request));
  if (!claims) return null;
  return env.DB.prepare('SELECT id, first_name, last_name, phone, role FROM users WHERE id = ?1')
    .bind(claims.id)
    .first<SessionUser>();
}

function publicUser(u: SessionUser) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    phone: u.phone,
    role: u.role,
  };
}

export { safeQuestions };
