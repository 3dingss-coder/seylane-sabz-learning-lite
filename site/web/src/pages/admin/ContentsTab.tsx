// بارگذاری محتوا: پادکست، ویدئو، آزمون — برای یک محصول مشخص.
import { useState, type FormEvent } from 'react';
import { Headphones, PlayCircle, ClipboardCheck, Plus } from 'lucide-react';
import { api } from '../../api';
import { Field } from '../../components/ui';
import { DeleteButton, Modal, SectionState, useAdminList } from './shared';
import { durationFa, fa } from '../../lib/format';

interface Brand {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  brand_name: string;
}
interface Quiz {
  id: string;
  title: string;
}
interface Content {
  id: string;
  product_id: string;
  product_name: string;
  kind: 'podcast' | 'video' | 'quiz';
  title: string;
  url: string;
  duration_sec: number;
  quiz_id: string | null;
  quiz_title: string | null;
}

const KIND_LABEL: Record<string, string> = { podcast: 'پادکست', video: 'ویدئو', quiz: 'آزمون' };
const KIND_ICON = { podcast: Headphones, video: PlayCircle, quiz: ClipboardCheck } as const;

interface Form {
  kind: 'podcast' | 'video' | 'quiz';
  title: string;
  url: string;
  durationSec: string;
  quizId: string;
}

export default function ContentsTab() {
  const { items: brands } = useAdminList<Brand>('/api/admin/brands');
  const { items: quizzes } = useAdminList<Quiz>('/api/admin/quizzes');

  const [brandId, setBrandId] = useState('');
  const { items: products } = useAdminList<Product>(
    brandId ? `/api/admin/products?brand=${encodeURIComponent(brandId)}` : '/api/admin/products',
  );
  const [productId, setProductId] = useState('');

  const { items, error, refresh } = useAdminList<Content>(
    productId ? `/api/admin/contents?product=${encodeURIComponent(productId)}` : '/api/admin/contents',
  );

  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError('');
    const f = editing.form;
    const payload =
      f.kind === 'quiz'
        ? { productId, kind: f.kind, title: f.title, quizId: f.quizId }
        : {
            productId,
            kind: f.kind,
            title: f.title,
            url: f.url,
            durationSec: f.durationSec === '' ? 0 : Number(f.durationSec),
          };
    try {
      if (editing.id) {
        await api(`/api/admin/contents/${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          body:
            f.kind === 'quiz'
              ? { title: f.title, quizId: f.quizId }
              : {
                  title: f.title,
                  url: f.url,
                  durationSec: f.durationSec === '' ? 0 : Number(f.durationSec),
                },
        });
      } else {
        await api('/api/admin/contents', { method: 'POST', body: payload });
      }
      setEditing(null);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ذخیره نشد');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      await api(`/api/admin/contents/${encodeURIComponent(id)}`, { method: 'DELETE' });
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'حذف نشد');
    } finally {
      setDeleting(null);
    }
  }

  const selectedProduct = products?.find((p) => p.id === productId);

  return (
    <div>
      <div className="card mb-4 p-4">
        <p className="mb-2 text-sm font-bold">۱) برند و محصول را انتخاب کنید</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="input flex-1"
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setProductId('');
            }}
            aria-label="برند"
          >
            <option value="">همه‌ی برندها</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="input flex-1"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            aria-label="محصول"
          >
            <option value="">همه‌ی محصولات</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
          {selectedProduct ? `محتواهای «${selectedProduct.name}»` : `${items ? fa(items.length) : '…'} محتوا در کل`}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!productId}
          onClick={() => setEditing({ form: { kind: 'podcast', title: '', url: '', durationSec: '', quizId: quizzes?.[0]?.id ?? '' } })}
        >
          <Plus size={16} aria-hidden />
          افزودن محتوا
        </button>
      </div>
      {!productId && (
        <p className="mb-3 text-xs" style={{ color: 'var(--color-ink-soft)' }}>
          برای افزودن محتوای جدید، اول یک محصول را از فهرست بالا انتخاب کنید.
        </p>
      )}

      <SectionState error={error} loading={!items && !error} onRetry={refresh} />
      {formError && !editing && <p className="err mb-3">{formError}</p>}
      {items && items.length === 0 && (
        <p className="card p-6 text-center">هنوز محتوایی اضافه نشده است.</p>
      )}

      <ul className="flex flex-col gap-2">
        {items?.map((c) => {
          const Icon = KIND_ICON[c.kind] ?? ClipboardCheck;
          return (
            <li key={c.id} className="card flex items-center gap-3 p-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--color-canvas)', color: 'var(--color-brand-500)' }}
              >
                <Icon size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.title}</p>
                <p className="truncate text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                  {KIND_LABEL[c.kind] ?? c.kind} · {c.product_name}
                  {c.kind === 'quiz' ? ` · آزمون: ${c.quiz_title ?? '—'}` : ''}
                  {c.kind === 'podcast' && c.duration_sec > 0 ? ` · ${durationFa(c.duration_sec)}` : ''}
                </p>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="num block truncate text-[11px]"
                    dir="ltr"
                  >
                    {c.url}
                  </a>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setProductId(c.product_id);
                  setEditing({
                    id: c.id,
                    form: {
                      kind: c.kind,
                      title: c.title,
                      url: c.url ?? '',
                      durationSec: String(c.duration_sec ?? ''),
                      quizId: c.quiz_id ?? quizzes?.[0]?.id ?? '',
                    },
                  });
                }}
              >
                ویرایش
              </button>
              <DeleteButton what={c.title} busy={deleting === c.id} onDelete={() => void remove(c.id)} />
            </li>
          );
        })}
      </ul>

      {editing && (
        <Modal title={editing.id ? 'ویرایش محتوا' : 'افزودن محتوا'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <Field label="نوع محتوا" htmlFor="c-kind" error={formError || undefined}>
              <select
                id="c-kind"
                className="input"
                value={editing.form.kind}
                disabled={!!editing.id}
                onChange={(e) =>
                  setEditing({ ...editing, form: { ...editing.form, kind: e.target.value as Form['kind'] } })
                }
              >
                <option value="podcast">پادکست (فایل صوتی)</option>
                <option value="video">ویدئو</option>
                <option value="quiz">آزمون</option>
              </select>
            </Field>

            <Field label="عنوان" htmlFor="c-title" hint="مثلاً: معرفی استیک ضدتعریق کامان">
              <input
                id="c-title"
                className="input"
                value={editing.form.title}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })}
                required
              />
            </Field>

            {editing.form.kind !== 'quiz' ? (
              <>
                <Field
                  label="لینک"
                  htmlFor="c-url"
                  hint="لینک یوتیوب، آپارات یا آدرس مستقیم فایل صوتی/ویدئویی را اینجا بچسبانید."
                >
                  <input
                    id="c-url"
                    className="input num"
                    dir="ltr"
                    placeholder="https://…"
                    value={editing.form.url}
                    onChange={(e) => setEditing({ ...editing, form: { ...editing.form, url: e.target.value } })}
                    required
                  />
                </Field>
                {editing.form.kind === 'podcast' && (
                  <Field label="مدت (ثانیه، اختیاری)" htmlFor="c-dur" hint="مثلاً ۳۰۰ یعنی ۵ دقیقه">
                    <input
                      id="c-dur"
                      type="number"
                      min="0"
                      className="input num"
                      value={editing.form.durationSec}
                      onChange={(e) => setEditing({ ...editing, form: { ...editing.form, durationSec: e.target.value } })}
                    />
                  </Field>
                )}
              </>
            ) : (
              <Field label="آزمون" htmlFor="c-quiz" hint="اول از بخش «آزمون‌ها» آزمون را بسازید.">
                <select
                  id="c-quiz"
                  className="input"
                  value={editing.form.quizId}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, quizId: e.target.value } })}
                  required
                >
                  <option value="">انتخاب کنید…</option>
                  {quizzes?.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
