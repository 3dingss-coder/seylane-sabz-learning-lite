// ابزارهای نمایشی: ارقام فارسی، تاریخ، مدت‌زمان.

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** ارقام لاتین → فارسی (فقط برای نمایش متن؛ نه برای لینک‌ها و ورودی‌ها). */
export function fa(input: number | string): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

/** 0912... → ۰۹۱۲... برای نمایش */
export function faPhone(phone: string): string {
  return fa(phone);
}

/** ثانیه → «۱۲:۳۵» یا «۱:۰۲:۳۵» */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** ثانیه → «۵ دقیقه» / «۱ ساعت و ۲۰ دقیقه» */
export function durationFa(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  if (s < 60) return fa(s) + ' ثانیه';
  const m = Math.round(s / 60);
  if (m < 60) return fa(m) + ' دقیقه';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest > 0 ? `${fa(h)} ساعت و ${fa(rest)} دقیقه` : `${fa(h)} ساعت`;
}

/** تاریخ ISO → «۱۲ مهر ۱۴۰۴» (با Intl، بدون کتابخانه‌ی تقویم) */
export function dateFa(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toLocaleDateString('fa-IR');
  }
}

/** تاریخ ISO → «۱۲ مهر ۱۴۰۴، ساعت ۱۴:۳۰» */
export function dateTimeFa(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString('fa-IR');
  }
}

/** «۳ روز پیش» — برای آخرین فعالیت */
export function relativeFa(iso: string | null | undefined): string {
  if (!iso) return 'هنوز فعالیتی ندارد';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '—';
  const diff = Date.now() - d;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'همین الان';
  if (min < 60) return fa(min) + ' دقیقه پیش';
  const hours = Math.round(min / 60);
  if (hours < 24) return fa(hours) + ' ساعت پیش';
  const days = Math.round(hours / 24);
  if (days < 31) return fa(days) + ' روز پیش';
  return dateFa(iso);
}

/** ارقام فارسی/عربی → لاتین، برای شماره تلفن */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u200c\u200d]/g, '');
}

/** فقط رقم (و + در ابتدا) — برای فیلد شماره تلفن */
export function sanitizePhone(input: string): string {
  const cleaned = toLatinDigits(input).replace(/[^\d+]/g, '');
  return cleaned.slice(0, 14);
}

export function isPhoneValid(input: string): boolean {
  let s = toLatinDigits(input).replace(/[\s-()]/g, '');
  if (s.startsWith('0098')) s = s.slice(4);
  else if (s.startsWith('+98')) s = s.slice(3);
  else if (s.startsWith('98') && s.length === 12) s = s.slice(2);
  if (s.length === 10 && s.startsWith('9')) s = '0' + s;
  return /^09\d{9}$/.test(s);
}
