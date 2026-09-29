// ابزارهای مشترک پنل مدیریت.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Trash2, X } from 'lucide-react';
import { api } from '../../api';
import { ErrorBox, Spinner } from '../../components/ui';

/** گرفتن یک لیست ادمین با قابلیت بارگذاری دوباره */
export function useAdminList<T>(path: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    // وقتی مسیر عوض می‌شود (مثلاً فیلتر برند)، فهرست قبلی را نشان نمی‌دهیم؛
    // وگرنه کاربر برای لحظه‌ای داده‌ی اشتباه می‌بیند.
    setItems(null);
    api<{ items: T[] }>(path)
      .then((res) => {
        if (alive) setItems(res.items);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [path, reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  return { items, error, refresh };
}

/** پنجره‌ی ساده برای فرم‌ها */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(10, 30, 20, 0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl"
        style={{ boxShadow: 'var(--shadow-pop)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="بستن">
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** دکمه‌ی حذف با تأیید دومرحله‌ای */
export function DeleteButton({
  onDelete,
  busy,
  what,
}: {
  onDelete: () => void;
  busy?: boolean;
  what: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setArmed(true)}
        aria-label={`حذف ${what}`}
      >
        <Trash2 size={16} aria-hidden />
      </button>
    );
  }
  return (
    <span className="flex gap-1">
      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onDelete}>
        {busy ? '…' : 'حذف شود'}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArmed(false)}>
        بی‌خیال
      </button>
    </span>
  );
}

/** سرصفحه‌ی هر بخش ادمین */
export function SectionState({ error, loading, onRetry }: { error: string; loading: boolean; onRetry: () => void }) {
  if (error) return <ErrorBox message={error} onRetry={onRetry} />;
  if (loading) return <Spinner />;
  return null;
}
