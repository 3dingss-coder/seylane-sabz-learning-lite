// وضعیت یادگیری بازاریاب‌ها + جزئیات هر نفر + خروجی CSV.
import { useState } from 'react';
import { ChevronLeft, Download } from 'lucide-react';
import { api, downloadCsv } from '../../api';
import { ProgressBar, Spinner, ErrorBox } from '../../components/ui';
import { Modal, SectionState, useAdminList } from './shared';
import { dateTimeFa, fa, faPhone, relativeFa } from '../../lib/format';

interface Marketer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  createdAt: string;
  done: number;
  total: number;
  percent: number;
  quizAvg: number | null;
  quizCount: number;
  lastActivity: string | null;
}

interface Item {
  content_id: string;
  kind: string;
  title: string;
  brand_name: string;
  product_name: string;
  status: string | null;
  percent: number | null;
  updated_at: string | null;
}

interface QuizAttempt {
  title: string | null;
  score: number;
  passed: number;
  correct: number;
  total: number;
  created_at: string;
}

interface Detail {
  user: Marketer;
  items: Item[];
  quizzes: QuizAttempt[];
}

const KIND_FA: Record<string, string> = { podcast: 'پادکست', video: 'ویدئو', quiz: 'آزمون' };

export default function MarketersTab() {
  const { items, error, refresh } = useAdminList<Marketer>('/api/admin/marketers');
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [query, setQuery] = useState('');

  async function openDetail(id: string) {
    setOpen(id);
    setDetail(null);
    setDetailError('');
    try {
      setDetail(await api<Detail>(`/api/admin/marketers/${encodeURIComponent(id)}`));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
    }
  }

  const filtered = (items ?? []).filter((m) =>
    `${m.firstName} ${m.lastName} ${m.phone}`.includes(query.trim()),
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          className="input flex-1"
          placeholder="جست‌وجو با نام یا شماره…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="جست‌وجوی بازاریاب"
        />
        <button type="button" className="btn btn-ghost" onClick={() => void downloadCsv()}>
          <Download size={18} aria-hidden />
          خروجی اکسل
        </button>
      </div>

      <SectionState error={error} loading={!items && !error} onRetry={refresh} />

      {items && items.length === 0 && <p className="card p-6 text-center">هنوز بازاریابی ثبت‌نام نکرده است.</p>}

      {items && filtered.length === 0 && query.trim() && (
        <p className="card p-6 text-center">بازاریابی با این نام یا شماره پیدا نشد.</p>
      )}

      <ul className="flex flex-col gap-2">
        {filtered.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => void openDetail(m.id)}
              className="card flex w-full items-center gap-3 p-4 text-right"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-600)' }}
                aria-hidden
              >
                {m.firstName.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {m.firstName} {m.lastName}
                  {m.role === 'admin' && (
                    <span className="badge badge-ok mr-2 text-[11px]">مدیر</span>
                  )}
                </span>
                <span className="num block text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                  {faPhone(m.phone)} · {relativeFa(m.lastActivity)}
                </span>
                <span className="mt-2 block">
                  <ProgressBar
                    percent={m.percent}
                    label={m.total > 0 ? `${fa(m.done)} از ${fa(m.total)} محتوا` : 'محتوایی وجود ندارد'}
                  />
                </span>
              </span>
              <ChevronLeft size={18} style={{ color: 'var(--color-ink-soft)' }} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <Modal title={detail ? `${detail.user.firstName} ${detail.user.lastName}` : 'جزئیات'} onClose={() => setOpen(null)}>
          {detailError && <ErrorBox message={detailError} />}
          {!detail && !detailError && <Spinner />}
          {detail && (
            <>
              <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <Info label="شماره" value={faPhone(detail.user.phone)} />
                <Info label="ثبت‌نام" value={dateTimeFa(detail.user.createdAt)} />
                <Info
                  label="میانگین آزمون"
                  value={
                    detail.quizzes.length > 0
                      ? `${fa(Math.round(detail.quizzes.reduce((s, q) => s + q.score, 0) / detail.quizzes.length))}٪`
                      : '—'
                  }
                />
                <Info label="تعداد آزمون" value={fa(detail.quizzes.length)} />
              </dl>

              <h3 className="mb-2 font-extrabold">وضعیت محتواها</h3>
              <ul className="mb-4 max-h-64 flex flex-col gap-1 overflow-y-auto text-sm">
                {detail.items.map((it) => (
                  <li
                    key={it.content_id}
                    className="flex items-center gap-2 rounded-lg px-3 py-2"
                    style={{ background: 'var(--color-canvas)' }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background:
                          it.status === 'completed'
                            ? 'var(--color-ok)'
                            : it.status === 'started'
                              ? 'var(--color-warn)'
                              : 'var(--color-line)',
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <strong>{it.brand_name}</strong> — {it.product_name}
                      <span className="text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                        {' '}
                        ({KIND_FA[it.kind] ?? it.kind}: {it.title})
                      </span>
                    </span>
                    <span className="badge text-[11px]" style={{ background: '#fff' }}>
                      {it.status === 'completed' ? 'کامل' : it.status === 'started' ? 'ناتمام' : 'شروع نشده'}
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="mb-2 font-extrabold">آزمون‌ها</h3>
              {detail.quizzes.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
                  هنوز آزمونی نداده است.
                </p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {detail.quizzes.map((q, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: 'var(--color-canvas)' }}
                    >
                      <span className="min-w-0 flex-1 truncate">{q.title ?? 'آزمون'}</span>
                      <span className="num text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                        {dateTimeFa(q.created_at)}
                      </span>
                      <span className={`badge text-[11px] ${q.passed ? 'badge-ok' : 'badge-fail'}`}>
                        <span className="num">{fa(q.score)}٪</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--color-canvas)' }}>
      <dt className="text-xs" style={{ color: 'var(--color-ink-soft)' }}>
        {label}
      </dt>
      <dd className="num truncate font-bold">{value}</dd>
    </div>
  );
}
