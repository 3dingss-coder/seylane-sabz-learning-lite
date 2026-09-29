// ثبت‌نام — نام، نام خانوادگی، شماره موبایل. بعد از ثبت‌نام مستقیم وارد می‌شود.
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '../store';
import { Field } from '../components/ui';
import { isPhoneValid, sanitizePhone } from '../lib/format';

export default function Signup() {
  const { signup } = useSession();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { phone?: string } };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(loc.state?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; phone?: string; form?: string }>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (firstName.trim().length < 2) next.firstName = 'نام خود را کامل بنویسید.';
    if (lastName.trim().length < 2) next.lastName = 'نام خانوادگی خود را کامل بنویسید.';
    if (!isPhoneValid(phone)) next.phone = 'شماره موبایل را کامل و درست وارد کنید. مثال: ۰۹۱۲۱۲۳۴۵۶۷';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await signup(firstName.trim(), lastName.trim(), phone);
      navigate('/brands', { replace: true });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'ثبت‌نام ناموفق بود. دوباره تلاش کنید.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Link to="/" className="btn btn-ghost btn-sm mb-6 self-start">
        بازگشت
      </Link>

      <h1 className="text-2xl font-extrabold">ثبت‌نام</h1>
      <p className="mt-1 mb-6" style={{ color: 'var(--color-ink-soft)' }}>
        فقط نام، نام خانوادگی و شماره موبایل. بعد از ثبت‌نام، مستقیم وارد می‌شوید.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <Field label="نام" htmlFor="firstName" error={errors.firstName}>
          <input
            id="firstName"
            name="firstName"
            className="input"
            autoComplete="given-name"
            placeholder="مثلاً سارا"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </Field>

        <Field label="نام خانوادگی" htmlFor="lastName" error={errors.lastName}>
          <input
            id="lastName"
            name="lastName"
            className="input"
            autoComplete="family-name"
            placeholder="مثلاً احمدی"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </Field>

        <Field label="شماره موبایل" htmlFor="phone" error={errors.phone} hint="با همین شماره وارد می‌شوید.">
          <input
            id="phone"
            name="phone"
            className="input num text-center text-lg tracking-widest"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(sanitizePhone(e.target.value))}
            required
          />
        </Field>

        {errors.form && (
          <p className="err mb-3" role="alert">
            {errors.form}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block text-lg" disabled={busy}>
          {busy ? 'در حال ثبت‌نام…' : 'ثبت‌نام و ورود'}
          {!busy && <ArrowLeft size={20} aria-hidden />}
        </button>
      </form>

      <p className="mt-8 text-center text-sm" style={{ color: 'var(--color-ink-soft)' }}>
        قبلاً ثبت‌نام کرده‌اید؟ <Link to="/login">وارد شوید</Link>
      </p>
    </main>
  );
}
