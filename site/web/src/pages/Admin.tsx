// پنل مدیریت — پنج بخش: بازاریاب‌ها، برندها، محصولات، محتوا، آزمون‌ها.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ErrorBox, Spinner } from '../components/ui';
import { fa } from '../lib/format';
import MarketersTab from './admin/MarketersTab';
import BrandsTab from './admin/BrandsTab';
import ProductsTab from './admin/ProductsTab';
import ContentsTab from './admin/ContentsTab';
import QuizzesTab from './admin/QuizzesTab';

interface Overview {
  marketers: number;
  brands: number;
  products: number;
  contents: number;
  quizzes: number;
  completed: number;
}

type TabId = 'marketers' | 'brands' | 'products' | 'contents' | 'quizzes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'marketers', label: 'بازاریاب‌ها' },
  { id: 'brands', label: 'برندها' },
  { id: 'products', label: 'محصولات' },
  { id: 'contents', label: 'محتوا' },
  { id: 'quizzes', label: 'آزمون‌ها' },
];

export default function Admin() {
  const [tab, setTab] = useState<TabId>('marketers');
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    api<Overview>('/api/admin/overview')
      .then((res) => {
        if (alive) setOv(res);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [reload, tab]);

  return (
    <Shell title="پنل مدیریت" wide>
      <section className="card mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-extrabold">نمای کلی</h1>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReload((n) => n + 1)}>
            به‌روزرسانی
          </button>
        </div>

        {error && <ErrorBox message={error} />}
        {!error && !ov && <Spinner />}

        {ov && (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="بازاریاب" value={ov.marketers} />
            <Stat label="برند" value={ov.brands} />
            <Stat label="محصول" value={ov.products} />
            <Stat label="محتوا" value={ov.contents} />
            <Stat label="تکمیل‌شده" value={ov.completed} />
          </dl>
        )}
      </section>

      <nav
        className="mb-4 flex gap-1 overflow-x-auto rounded-xl p-1"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}
        aria-label="بخش‌های مدیریت"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-4 text-sm font-bold"
            style={{
              background: tab === t.id ? 'var(--color-brand-500)' : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--color-ink-soft)',
            }}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'marketers' && <MarketersTab />}
      {tab === 'brands' && <BrandsTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'contents' && <ContentsTab />}
      {tab === 'quizzes' && <QuizzesTab />}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-canvas)' }}>
      <dt className="text-xs" style={{ color: 'var(--color-ink-soft)' }}>
        {label}
      </dt>
      <dd className="num text-2xl font-extrabold">{fa(value)}</dd>
    </div>
  );
}
