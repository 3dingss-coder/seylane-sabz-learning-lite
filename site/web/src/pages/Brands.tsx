// صفحه‌ی اصلی: لیست برندها با پیشرفت هر کدام.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Package } from 'lucide-react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ErrorBox, ProgressBar, Ring, Spinner } from '../components/ui';
import { SmartImage } from '../components/SmartImage';
import { fa } from '../lib/format';

interface BrandRow {
  id: string;
  name: string;
  nameEn: string;
  logo: string;
  productCount: number;
  done: number;
  total: number;
  percent: number;
  doneProducts: number;
}

export default function Brands() {
  const [rows, setRows] = useState<BrandRow[] | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const load = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setError('');
    api<{ brands: BrandRow[] }>('/api/catalog')
      .then((res) => {
        if (alive) setRows(res.brands);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  const overall =
    rows && rows.length > 0
      ? Math.round(
          (rows.reduce((s, b) => s + b.done, 0) / Math.max(1, rows.reduce((s, b) => s + b.total, 0))) * 100,
        )
      : 0;

  return (
    <Shell title="برندها">
      <section className="card mb-5 flex items-center gap-4 p-4">
        <Ring percent={overall} size={64} />
        <div>
          <p className="font-extrabold">پیشرفت کلی آموزش شما</p>
          <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
            یک برند را انتخاب کنید، محصول را باز کنید و پادکست، ویدئو و آزمونش را کامل کنید.
          </p>
        </div>
      </section>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!error && !rows && <Spinner label="در حال بارگذاری برندها…" />}

      {rows && rows.length === 0 && (
        <p className="card p-6 text-center">هنوز برندی اضافه نشده است.</p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows?.map((b) => (
          <li key={b.id}>
            <Link
              to={`/brands/${b.id}`}
              className="card flex h-full flex-col items-center gap-2 p-4 text-center transition hover:shadow-[var(--shadow-pop)]"
            >
              <SmartImage
                src={b.logo}
                alt={b.name}
                className="h-16 w-16 rounded-xl object-contain p-1"
              />
              <p className="text-sm font-extrabold leading-tight">{b.name}</p>
              {b.nameEn && (
                <p className="num -mt-1 text-[11px]" style={{ color: 'var(--color-ink-soft)' }}>
                  {b.nameEn}
                </p>
              )}
              <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                <Package size={13} aria-hidden />
                <span className="num">{fa(b.productCount)}</span> محصول
              </p>
              <div className="mt-auto w-full pt-2">
                <ProgressBar
                  percent={b.percent}
                  label={b.total > 0 ? `${fa(b.done)} از ${fa(b.total)}` : 'محتوایی ندارد'}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {rows && rows.length > 0 && (
        <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-ink-soft)' }}>
          <ChevronLeft size={14} className="inline" aria-hidden /> روی هر برند بزنید تا محصولاتش را ببینید.
        </p>
      )}
    </Shell>
  );
}
