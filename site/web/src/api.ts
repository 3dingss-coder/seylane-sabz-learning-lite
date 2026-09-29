// =====================================================================
//  کلاینت API — همه‌ی ارتباط با Cloudflare Worker از همین‌جا می‌گذرد.
// =====================================================================

/** در توسعه: پروکسی Vite. در تولید: آدرس Worker (VITE_API_BASE). */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export const TOKEN_KEY = 'ssl.token';
export const USER_KEY = 'ssl.user';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'marketer' | 'admin';
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSession(token: string, user: User): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* حالت incognito یا storage غیرفعال — جلسه فقط در حافظه می‌ماند */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* بی‌اثر */
  }
}

export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
  token?: string | null;
  /**
   * وقتی پاسخ 401 باشد چه کنیم:
   *  - 'handler' (پیش‌فرض): SessionProvider را خبر می‌کنیم تا تمیز خارج کند
   *  - 'silent': فقط خطا را پرتاب می‌کنیم (برای بررسی اولیه‌ی توکن)
   */
  unauthorized?: 'handler' | 'silent';
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** SessionProvider این را ثبت می‌کند تا همه‌ی 401ها از یک مسیر مدیریت شوند. */
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true, token, unauthorized = 'handler' } = opts;
  const t = token !== undefined ? token : getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // خطای شبکه (سرور خاموش، آفلاین، قطع پروکسی). این با «توکن باطل»
    // فرق دارد و هرگز نباید باعث خروج کاربر شود.
    throw new ApiError(
      'NETWORK',
      'اتصال به سرور برقرار نشد. کمی صبر کنید و دوباره تلاش کنید.',
      0,
    );
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* پاسخ غیر JSON */
  }

  if (!res.ok) {
    const err = data as { error?: string; message?: string } | null;
    // 401 یعنی توکن باطل است. فقط وقتی که واقعاً توکنی فرستاده بودیم
    // جلسه را باطل می‌کنیم؛ مسیریابی را به React Router می‌سپاریم.
    if (res.status === 401 && auth && t) {
      clearSession();
      if (unauthorized === 'handler') unauthorizedHandler?.();
    }
    throw new ApiError(
      err?.error ?? 'ERROR',
      err?.message ?? 'خطایی رخ داد. دوباره تلاش کنید.',
      res.status,
    );
  }
  return data as T;
}

/** دانلود CSV گزارش ادمین */
export async function downloadCsv(): Promise<void> {
  const t = getToken();
  const res = await fetch(`${API_BASE}/api/admin/export.csv`, {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
  if (!res.ok) throw new ApiError('EXPORT_FAILED', 'خروجی گرفتن ناموفق بود.', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'marketers.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
