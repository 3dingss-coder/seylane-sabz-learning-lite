// ابزارهای کوچک و مشترک — بدون هیچ وابستگی بیرونی.

/** تبدیل ارقام فارسی/عربی به لاتین و حذف کاراکترهای نامرئی. */
export function toLatinDigits(input: string): string {
  return String(input ?? '')
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, '');
}

/**
 * نرمال‌سازی شماره موبایل ایرانی به شکل 09xxxxxxxxx.
 * ورودی‌های پذیرفته‌شده: 09121234567 / 9121234567 / +989121234567 / 989121234567 / 00989121234567
 * اگر معتبر نباشد null برمی‌گرداند.
 */
export function normalizePhone(raw: unknown): string | null {
  let s = toLatinDigits(raw as string).replace(/[\s\-().]/g, '');
  if (!s) return null;
  if (s.startsWith('0098')) s = s.slice(4);
  else if (s.startsWith('+98')) s = s.slice(3);
  else if (s.startsWith('98') && s.length === 12) s = s.slice(2);
  if (s.length === 10 && s.startsWith('9')) s = '0' + s;
  if (!/^09\d{9}$/.test(s)) return null;
  return s;
}

/** نام کوتاه و خوانا: «سارا احمدی» */
export function fullName(u: { first_name: string; last_name: string }): string {
  return `${u.first_name} ${u.last_name}`.trim();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(crypto: Crypto): string {
  return crypto.randomUUID();
}

// ---------- base64url (فقط ASCII در payload استفاده می‌شود) ----------
export function b64urlEncode(bytes: Uint8Array | string): string {
  const str = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
}
