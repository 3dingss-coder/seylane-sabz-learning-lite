// صفحه‌ی محصول — دقیقاً سه گزینه: پادکست، ویدئو، آزمون.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Headphones, PlayCircle } from 'lucide-react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ErrorBox, ProgressBar, Spinner } from '../components/ui';
import { SmartImage } from '../components/SmartImage';
import { durationFa, fa } from '../lib/format';

type Kind = 'podcast' | 'video' | 'quiz';

interface Item {
  id: string;
  kind: Kind;
  title: string;
  url: string;
  durationSec: number;
  completed: boolean;
}

interface Detail {
  product: {
    id: string;
    name: string;
    code: string;
    category: string;
    image: string;
    description: string;
    brandId: string;
    brandName: string;
  };
  items: Item[];
  done: number;
  total: number;
}

const KINDS: { kind: Kind; label: string; hint: string; icon: typeof Headphones; color: string }[] = [
  {
    kind: 'podcast',
    label: 'پادکست',
    hint: 'فایل صوتی را گوش کنید',
    icon: Headphones,
    color: 'var(--color-info)',
  },
  {
    kind: 'video',
    label: 'ویدئو',
    hint: 'فیلم آموزشی را ببینید',
    icon: PlayCircle,
    color: 'var(--color-brand-500)',
  },
  {
    kind: 'quiz',
    label: 'آزمون',
    hint: 'با چند سؤال، خودتان را بسنجید',
    icon: ClipboardCheck,
    color: 'var(--color-warn)',
  },
];

export default function Product() {
  const { productId = '' } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const load = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setError('');
    api<Detail>(`/api/products/${encodeURIComponent(productId)}`)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [productId, reload]);

  return (
    <Shell title={data?.product.name ?? 'محصول'} back={data ? `/brands/${data.product.brandId}` : '/brands'}>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!error && !data && <Spinner label="در حال بارگذاری…" />}

      {data && (
        <>
          <section className="card mb-5 p-4">
            <div className="flex gap-4">
              <SmartImage
                src={data.product.image}
                alt={data.product.name}
                className="h-24 w-24 shrink-0 rounded-xl object-contain"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold" style={{ color: 'var(--color-brand-500)' }}>
                  {data.product.brandName}
                </p>
                <h1 className="text-lg font-extrabold leading-snug">{data.product.name}</h1>
                {data.product.code && (
                  <p className="num text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                    کد محصول: {data.product.code}
                  </p>
                )}
              </div>
            </div>
            {data.product.description && (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
                {data.product.description}
              </p>
            )}
            <div className="mt-4">
              <ProgressBar
                percent={data.total > 0 ? (data.done / data.total) * 100 : 0}
                label={
                  data.total > 0
                    ? `${fa(data.done)} از ${fa(data.total)} مرحله کامل شده`
                    : 'هنوز محتوایی برای این محصول اضافه نشده است'
                }
              />
            </div>
          </section>

          <h2 className="mb-3 text-lg font-extrabold">سه مرحله‌ی آموزش این محصول</h2>

          <div className="flex flex-col gap-3">
            {KINDS.map(({ kind, label, hint, icon: Icon, color }) => {
              const items = data.items.filter((i) => i.kind === kind);
              const done = items.filter((i) => i.completed).length;
              return (
                <section key={kind} className="card p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: 'var(--color-canvas)', color }}
                    >
                      <Icon size={22} aria-hidden />
                    </span>
                    <div className="flex-1">
                      <p className="font-extrabold">{label}</p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                        {hint}
                      </p>
                    </div>
                    {items.length > 0 && (
                      <span className={`badge ${done === items.length ? 'badge-ok' : 'badge-todo'}`}>
                        {done === items.length ? (
                          <>
                            <CheckCircle2 size={14} aria-hidden /> کامل شد
                          </>
                        ) : (
                          <span className="num">
                            {fa(done)} از {fa(items.length)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <p className="rounded-xl p-3 text-sm" style={{ background: 'var(--color-canvas)', color: 'var(--color-ink-soft)' }}>
                      هنوز {label}ی برای این محصول گذاشته نشده. بعداً سر بزنید.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {items.map((item) => (
                        <li key={item.id}>
                          <Link
                            to={kind === 'quiz' ? `/quiz/${item.id}` : `/learn/${item.id}`}
                            className="flex min-h-[52px] items-center gap-3 rounded-xl border p-3"
                            style={{ borderColor: 'var(--color-line)' }}
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                              style={{
                                background: item.completed ? 'var(--color-ok-soft)' : 'var(--color-canvas)',
                                color: item.completed ? 'var(--color-ok)' : 'var(--color-ink-soft)',
                              }}
                              aria-hidden
                            >
                              {item.completed ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">{item.title}</span>
                              {kind === 'podcast' && item.durationSec > 0 && (
                                <span className="num block text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                                  {durationFa(item.durationSec)}
                                </span>
                              )}
                            </span>
                            <span className="text-sm font-bold" style={{ color }}>
                              {item.completed ? 'مرور' : kind === 'quiz' ? 'شروع آزمون' : 'باز کردن'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
