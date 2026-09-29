// محصولات یک برند + جست‌وجو.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ErrorBox, ProgressBar, Spinner } from '../components/ui';
import { SmartImage } from '../components/SmartImage';
import { fa, toLatinDigits } from '../lib/format';

interface ProductRow {
  id: string;
  name: string;
  code: string;
  category: string;
  image: string;
  done: number;
  total: number;
  percent: number;
}

export default function Brand() {
  const { brandId = '' } = useParams();
  const [data, setData] = useState<{ brand: { name: string; nameEn: string }; products: ProductRow[] } | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);
  const load = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setError('');
    setData(null);
    api<{ brand: { name: string; nameEn: string }; products: ProductRow[] }>(`/api/brands/${encodeURIComponent(brandId)}`)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [brandId, reload]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = toLatinDigits(query.trim().toLowerCase());
    if (!q) return data.products;
    return data.products.filter((p) =>
      toLatinDigits(`${p.name} ${p.code} ${p.category}`.toLowerCase()).includes(q),
    );
  }, [data, query]);

  return (
    <Shell title={data?.brand.name ?? 'محصولات'} back="/brands">
      {error && <ErrorBox message={error} onRetry={load} />}
      {!error && !data && <Spinner label="در حال بارگذاری محصولات…" />}

      {data && (
        <>
          <label className="sr-only" htmlFor="search">
            جست‌وجوی محصول
          </label>
          <div className="relative mb-4">
            <Search
              size={18}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
              style={{ color: 'var(--color-ink-soft)' }}
              aria-hidden
            />
            <input
              id="search"
              type="search"
              className="input pr-10"
              placeholder="جست‌وجوی محصول یا کد محصول…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <p className="mb-3 text-sm" style={{ color: 'var(--color-ink-soft)' }}>
            <span className="num">{fa(filtered.length)}</span> محصول
            {query.trim() && ' پیدا شد'}
          </p>

          {filtered.length === 0 ? (
            <p className="card p-6 text-center">
              محصولی با این نام پیدا نشد. عبارت دیگری را امتحان کنید.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((p) => (
                <li key={p.id}>
                  <Link to={`/products/${p.id}`} className="card flex items-center gap-3 p-3">
                    <SmartImage src={p.image} alt={p.name} className="h-16 w-16 shrink-0 rounded-lg object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-snug">{p.name}</p>
                      {p.category && (
                        <p className="truncate text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                          {p.category}
                        </p>
                      )}
                      <div className="mt-2">
                        <ProgressBar
                          percent={p.percent}
                          label={p.total > 0 ? `${fa(p.done)} از ${fa(p.total)} کامل شده` : 'هنوز محتوایی ندارد'}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Shell>
  );
}
