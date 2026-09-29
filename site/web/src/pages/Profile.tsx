// حساب من — آمار شخصی و خروج.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { useSession } from '../store';
import { Shell } from '../components/Shell';
import { ErrorBox, ProgressBar, Spinner } from '../components/ui';
import { fa, faPhone } from '../lib/format';

interface Me {
  user: { firstName: string; lastName: string; phone: string; role: string };
  stats: { total: number; done: number; quizzes: number };
}

export default function Profile() {
  const { user, logout } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const load = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setError('');
    api<Me>('/api/me')
      .then((res) => {
        if (alive) setMe(res);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  return (
    <Shell title="حساب من">
      <section className="card mb-4 p-5 text-center">
        <img src="./icons/logo-mark-transparent.png" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-3 text-xl font-extrabold">
          {user?.firstName} {user?.lastName}
        </h1>
        <p className="num mt-1 text-sm" style={{ color: 'var(--color-ink-soft)' }}>
          {faPhone(user?.phone ?? '')}
        </p>
        {user?.role === 'admin' && (
          <span className="badge badge-ok mt-2">
            <ShieldCheck size={14} aria-hidden /> مدیر
          </span>
        )}
      </section>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!error && !me && <Spinner label="در حال بارگذاری…" />}

      {me && (
        <section className="card mb-4 p-5">
          <h2 className="mb-3 font-extrabold">پیشرفت آموزش</h2>
          <ProgressBar
            percent={me.stats.total > 0 ? (me.stats.done / me.stats.total) * 100 : 0}
            label={
              me.stats.total > 0
                ? `${fa(me.stats.done)} از ${fa(me.stats.total)} محتوا کامل شده`
                : 'هنوز محتوایی برای کامل‌کردن وجود ندارد'
            }
          />
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl p-3" style={{ background: 'var(--color-canvas)' }}>
              <dt className="text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                محتوای کامل‌شده
              </dt>
              <dd className="num text-xl font-extrabold">{fa(me.stats.done)}</dd>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--color-canvas)' }}>
              <dt className="text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                کل محتواها
              </dt>
              <dd className="num text-xl font-extrabold">{fa(me.stats.total)}</dd>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--color-canvas)' }}>
              <dt className="text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                آزمون داده‌شده
              </dt>
              <dd className="num text-xl font-extrabold">{fa(me.stats.quizzes)}</dd>
            </div>
          </dl>
        </section>
      )}

      {user?.role === 'admin' && (
        <Link to="/admin" className="btn btn-ghost btn-block mb-3">
          <ShieldCheck size={18} aria-hidden />
          رفتن به پنل مدیریت
        </Link>
      )}
      <Link to="/brands" className="btn btn-ghost btn-block mb-3">
        دیدن برندها و محصولات
      </Link>
      <button type="button" className="btn btn-danger btn-block" onClick={logout}>
        <LogOut size={18} aria-hidden />
        خروج از حساب
      </button>
    </Shell>
  );
}
