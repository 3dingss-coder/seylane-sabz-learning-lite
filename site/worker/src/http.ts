// پاسخ‌های HTTP، CORS و مسیریابی کوچک.
export function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

export function fail(code: string, message: string, status = 400, extraHeaders: HeadersInit = {}): Response {
  return json({ error: code, message }, status, extraHeaders);
}

/** هدرهای CORS بر اساس allowlist */
export function corsHeaders(request: Request, env: { ALLOWED_ORIGINS?: string }): HeadersInit {
  const origin = request.headers.get('Origin') ?? '';
  const raw = String(env.ALLOWED_ORIGINS ?? '*').trim();
  let allow = '*';
  if (raw && raw !== '*') {
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    allow = list.includes(origin) ? origin : list[0] ?? '*';
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export const TOKEN_COOKIE = 'ssl_token';

/**
 * بیرون کشیدن توکن جلسه از درخواست.
 *
 * سه راه را قبول می‌کنیم، چون بعضی پروکسی‌ها (مثل پروکسی پیش‌نمایش) هدر
 * Authorization را در میانه‌ی راه حذف می‌کنند و کاربر با وجود توکن معتبر
 * خطای ۴۰۱ و «جلسه‌ی شما تمام شد» می‌دید.
 *   ۱) هدر استاندارد  Authorization: Bearer <token>
 *   ۲) هدر سفارشی      X-Auth-Token: <token>   ← پروکسی‌ها معمولاً این را نگه می‌دارند
 *   ۳) کوکی            ssl_token=<token>       ← مرورگر خودش می‌فرستد
 */
export function bearer(request: Request): string | null {
  const h = request.headers.get('Authorization') ?? '';
  if (h.toLowerCase().startsWith('bearer ')) {
    const t = h.slice(7).trim();
    if (t) return t;
  }
  const custom = (request.headers.get('X-Auth-Token') ?? '').trim();
  if (custom) return custom;
  const cookie = request.headers.get('Cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]+)`));
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null;
}

/** هدر Set-Cookie برای نگه‌داشتن توکن به‌عنوان جایگزینِ هدر Authorization */
export function sessionCookie(token: string, maxAgeDays = 30): string {
  return `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeDays * 86400}; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

/** جدا کردن بخش‌های مسیر بعد از یک پیشوند، مثال: /api/admin/brands/xyz → ['brands','xyz'] */
export function pathSegments(url: URL, prefix: string): string[] {
  const p = url.pathname.replace(/\/+$/, '');
  const base = prefix.replace(/\/+$/, '');
  if (!p.startsWith(base)) return [];
  return p.slice(base.length).split('/').filter(Boolean).map(decodeURIComponent);
}
