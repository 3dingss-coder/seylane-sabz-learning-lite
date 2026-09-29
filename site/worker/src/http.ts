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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function bearer(request: Request): string | null {
  const h = request.headers.get('Authorization') ?? '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : null;
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
