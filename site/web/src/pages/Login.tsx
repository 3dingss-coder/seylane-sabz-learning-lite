// ورود — فقط یک فیلد: شماره موبایل.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { ApiError } from '../api';
import { useSession } from '../store';
import { Field } from '../components/ui';
import { faPhone, isPhoneValid, sanitizePhone } from '../lib/format';

export default function Login() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotRegistered(false);

    if (!isPhoneValid(phone)) {
      setError('شماره موبایل را کامل و درست وارد کنید. مثال: ۰۹۱۲۱۲۳۴۵۶۷');
      return;
    }
    setBusy(true);
    try {
      await login(phone);
      navigate('/brands', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotRegistered(true);
        setError('این شماره هنوز ثبت نشده است.');
      } else {
        setError(err instanceof Error ? err.message : 'ورود ناموفق بود. دوباره تلاش کنید.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Link to="/" className="btn btn-ghost btn-sm mb-6 self-start">
        بازگشت
      </Link>

      <h1 className="text-2xl font-extrabold">ورود</h1>
      <p className="mt-1 mb-6" style={{ color: 'var(--color-ink-soft)' }}>
        شماره موبایلی که با آن ثبت‌نام کرده‌اید را وارد کنید.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <Field label="شماره موبایل" htmlFor="phone" error={error || undefined} hint="مثال: ۰۹۱۲۱۲۳۴۵۶۷">
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

        <button type="submit" className="btn btn-primary btn-block text-lg" disabled={busy}>
          {busy ? 'در حال ورود…' : 'ورود'}
          {!busy && <ArrowLeft size={20} aria-hidden />}
        </button>
      </form>

      {notRegistered && (
        <div className="card mt-5 p-4 text-center" style={{ background: 'var(--color-info-soft)' }}>
          <p className="font-bold">قبلاً ثبت‌نام نکرده‌اید؟</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-soft)' }}>
            با شماره <span className="num">{faPhone(phone)}</span> یک حساب بسازید. کمتر از یک دقیقه طول می‌کشد.
          </p>
          <Link to="/signup" state={{ phone }} className="btn btn-primary btn-sm mt-3">
            <UserPlus size={16} aria-hidden />
            ثبت‌نام با همین شماره
          </Link>
        </div>
      )}

      <p className="mt-8 text-center text-sm" style={{ color: 'var(--color-ink-soft)' }}>
        <Link to="/signup">حساب ندارم، ثبت‌نام می‌کنم</Link>
      </p>
    </main>
  );
}
