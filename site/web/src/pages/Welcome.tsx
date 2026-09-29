// صفحه‌ی اول — فقط دو دکمه: ورود و ثبت‌نام.
import { Navigate, Link } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useSession } from '../store';

export default function Welcome() {
  const { user, ready } = useSession();
  if (ready && user) return <Navigate to="/brands" replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <img src="./icons/logo-full.png" alt="لوگوی سیلانه‌سبز" className="h-24 w-auto" />
        <h1 className="mt-6 text-2xl font-extrabold">آموزش سیلانه‌سبز</h1>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
          برای هر محصول سه چیز داریم: <strong>پادکست</strong>، <strong>ویدئو</strong> و <strong>آزمون</strong>.
          <br />
          هر وقت خواستی، با شماره موبایلت وارد شو.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-3">
        <Link to="/login" className="btn btn-primary btn-block text-lg">
          ورود با شماره موبایل
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <Link to="/signup" className="btn btn-ghost btn-block">
          <UserPlus size={20} aria-hidden />
          حساب ندارم، ثبت‌نام می‌کنم
        </Link>
      </div>

      <p className="mt-8 text-center text-sm" style={{ color: 'var(--color-ink-soft)' }}>
        ورود فقط با شماره موبایل است؛ رمزی در کار نیست.
      </p>
    </main>
  );
}
