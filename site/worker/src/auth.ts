// احراز هویت: توکن امضاشده با HMAC-SHA256 (بدون کتابخانه‌ی خارجی).
// ورود فقط با شماره تلفن است؛ شماره‌ی ادمین از طریق متغیر ADMIN_PHONE مشخص می‌شود.
import { b64urlDecode, b64urlEncode, normalizePhone, nowIso, uuid } from './util';

export interface SessionUser {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: 'marketer' | 'admin';
}

export interface Env {
  DB: D1Database;
  AUTH_SECRET: string;
  ADMIN_PHONE?: string;
  ALLOWED_ORIGINS?: string;
  TOKEN_TTL_DAYS?: string;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

/** ساخت توکن: payload.signature */
export async function signToken(env: Env, user: SessionUser): Promise<string> {
  const ttlDays = Number(env.TOKEN_TTL_DAYS ?? '30');
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  const payload = b64urlEncode(JSON.stringify({ u: user.id, r: user.role, e: exp }));
  return `${payload}.${await hmac(env.AUTH_SECRET, payload)}`;
}

/** بررسی توکن؛ در صورت نامعتبر بودن null */
export async function verifyToken(env: Env, token: string | null): Promise<{ id: string; role: string } | null> {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.') as [string, string];
  const expected = await hmac(env.AUTH_SECRET, payload);
  if (sig.length !== expected.length) return null;
  // مقایسه‌ی زمان‌ثابت
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload)) as { u: string; r: string; e: number };
    if (!data.u || typeof data.e !== 'number' || data.e * 1000 < Date.now()) return null;
    return { id: data.u, role: data.r };
  } catch {
    return null;
  }
}

/** شماره‌هایی که ادمین هستند (از ADMIN_PHONE، با جداکننده‌ی ویرگول) */
export function adminPhones(env: Env): string[] {
  return String(env.ADMIN_PHONE ?? '')
    .split(',')
    .map((p) => normalizePhone(p))
    .filter((p): p is string => Boolean(p));
}

export function roleFor(env: Env, phone: string): 'marketer' | 'admin' {
  return adminPhones(env).includes(phone) ? 'admin' : 'marketer';
}

/** ثبت‌نام یا به‌روزرسانی نقش کاربر موجود */
export async function upsertUser(
  env: Env,
  input: { firstName: string; lastName: string; phone: string },
): Promise<SessionUser> {
  const existing = await env.DB.prepare('SELECT * FROM users WHERE phone = ?1')
    .bind(input.phone)
    .first<Record<string, unknown>>();
  const role = roleFor(env, input.phone);
  if (existing) {
    // نام را به‌روز می‌کنیم؛ نقش را فقط ارتقا می‌دهیم، هرگز تنزل نمی‌دهیم.
    await env.DB.prepare(
      'UPDATE users SET first_name = ?1, last_name = ?2, role = CASE WHEN ?3 = \'admin\' THEN \'admin\' ELSE role END WHERE id = ?4',
    )
      .bind(input.firstName, input.lastName, role, existing.id)
      .run();
    return {
      id: String(existing.id),
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      role: (role === 'admin' ? 'admin' : String(existing.role)) as 'marketer' | 'admin',
    };
  }
  const user: SessionUser = {
    id: uuid(crypto),
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    role,
  };
  await env.DB.prepare(
    'INSERT INTO users (id, first_name, last_name, phone, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
  )
    .bind(user.id, user.first_name, user.last_name, user.phone, user.role, nowIso())
    .run();
  return user;
}
