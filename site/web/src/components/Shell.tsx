// قاب کلی صفحات وارد شده: نوار بالا + ناوبری پایین در موبایل.
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutGrid, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useSession } from '../store';

export function Shell({
  title,
  back,
  children,
  wide,
}: {
  title?: string;
  back?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { user, logout } = useSession();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header
        className="top-bar sticky top-0 z-20 border-b"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}
      >
        <div className={`mx-auto flex items-center gap-3 px-4 pb-3 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
          {back ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(back)} aria-label="بازگشت">
              <ChevronRight size={18} aria-hidden />
            </button>
          ) : (
            <Link to="/brands" className="flex items-center" aria-label="صفحه‌ی اصلی">
              <img src="./icons/logo-mark-transparent.png" alt="" width={34} height={34} className="h-9 w-9" />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold leading-tight">{title ?? 'آموزش سیلانه‌سبز'}</p>
            {user && (
              <p className="truncate text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                {user.firstName} {user.lastName}
              </p>
            )}
          </div>

          <Link to="/me" className="btn btn-ghost btn-sm" aria-label="حساب من">
            <UserIcon size={18} aria-hidden />
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className="btn btn-ghost btn-sm" aria-label="پنل مدیریت">
              <ShieldCheck size={18} aria-hidden />
            </Link>
          )}
        </div>
      </header>

      <main className={`mx-auto px-4 py-5 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>{children}</main>

      {/* ناوبری پایین فقط در موبایل؛ در دسکتاپ همان لینک‌ها در نوار بالا هستند */}
      <nav
        className="bottom-nav fixed inset-x-0 bottom-0 z-20 border-t bg-white md:hidden"
        style={{ borderColor: 'var(--color-line)' }}
        aria-label="ناوبری اصلی"
      >
        <div className="mx-auto flex max-w-2xl items-stretch justify-around">
          <TabLink to="/brands" label="برندها" icon={<LayoutGrid size={20} aria-hidden />} />
          {user?.role === 'admin' && (
            <TabLink to="/admin" label="مدیریت" icon={<ShieldCheck size={20} aria-hidden />} />
          )}
          <TabLink to="/me" label="حساب من" icon={<UserIcon size={20} aria-hidden />} />
        </div>
      </nav>

      <footer className="mx-auto hidden max-w-5xl justify-center gap-4 px-4 pb-8 text-sm md:flex" style={{ color: 'var(--color-ink-soft)' }}>
        <Link to="/brands">برندها</Link>
        <Link to="/me">حساب من</Link>
        {user?.role === 'admin' && <Link to="/admin">پنل مدیریت</Link>}
        <button type="button" onClick={logout} className="inline-flex items-center gap-1">
          <LogOut size={14} aria-hidden />
          خروج
        </button>
        <span className="num">سیلانه‌سبز</span>
      </footer>
    </div>
  );
}

function TabLink({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-bold"
      style={({ isActive }) => ({ color: isActive ? 'var(--color-brand-500)' : 'var(--color-ink-soft)' })}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
