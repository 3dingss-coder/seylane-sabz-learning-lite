// مدیریت محصولات.
import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api';
import { Field } from '../../components/ui';
import { SmartImage } from '../../components/SmartImage';
import { DeleteButton, Modal, SectionState, useAdminList } from './shared';
import { fa } from '../../lib/format';

interface Product {
  id: string;
  brand_id: string;
  brand_name: string;
  name: string;
  code: string;
  category: string;
  image: string;
  description: string;
  sort_order: number;
  content_count: number;
}

interface Brand {
  id: string;
  name: string;
}

interface Form {
  brandId: string;
  name: string;
  code: string;
  category: string;
  image: string;
  description: string;
  sortOrder: string;
}

const empty: Form = { brandId: '', name: '', code: '', category: '', image: '', description: '', sortOrder: '' };

export default function ProductsTab() {
  const { items: brands } = useAdminList<Brand>('/api/admin/brands');
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const { items, error, refresh } = useAdminList<Product>(
    filter ? `/api/admin/products?brand=${encodeURIComponent(filter)}` : '/api/admin/products',
  );

  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q || !items) return items;
    return items.filter((p) => `${p.name} ${p.code}`.includes(q));
  }, [items, query]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError('');
    const payload = {
      brandId: editing.form.brandId,
      name: editing.form.name,
      code: editing.form.code,
      category: editing.form.category,
      image: editing.form.image,
      description: editing.form.description,
      sortOrder: editing.form.sortOrder === '' ? 0 : Number(editing.form.sortOrder),
    };
    try {
      if (editing.id) await api(`/api/admin/products/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: payload });
      else await api('/api/admin/products', { method: 'POST', body: payload });
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
      await api(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'حذف نشد');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <select className="input sm:w-56" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="فیلتر برند">
          <option value="">همه‌ی برندها</option>
          {brands?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          className="input flex-1"
          placeholder="جست‌وجوی محصول…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="جست‌وجوی محصول"
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setEditing({ form: { ...empty, brandId: filter || (brands?.[0]?.id ?? '') } })}
        >
          <Plus size={16} aria-hidden />
          افزودن محصول
        </button>
      </div>

      <SectionState error={error} loading={!items && !error} onRetry={refresh} />
      {formError && !editing && <p className="err mb-3">{formError}</p>}
      <p className="mb-2 text-sm" style={{ color: 'var(--color-ink-soft)' }}>
        {filtered ? `${fa(filtered.length)} محصول` : ''}
      </p>

      <ul className="flex flex-col gap-2">
        {filtered?.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-3">
            <SmartImage src={p.image} alt={p.name} className="h-12 w-12 shrink-0 rounded-lg object-contain" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{p.name}</p>
              <p className="num truncate text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                {p.brand_name} · کد {p.code || '—'} · {fa(p.content_count)} محتوا
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setEditing({
                  id: p.id,
                  form: {
                    brandId: p.brand_id,
                    name: p.name,
                    code: p.code ?? '',
                    category: p.category ?? '',
                    image: p.image ?? '',
                    description: p.description ?? '',
                    sortOrder: String(p.sort_order ?? 0),
                  },
                })
              }
            >
              ویرایش
            </button>
            <DeleteButton what={p.name} busy={deleting === p.id} onDelete={() => void remove(p.id)} />
          </li>
        ))}
      </ul>

      {editing && (
        <Modal title={editing.id ? 'ویرایش محصول' : 'افزودن محصول'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <Field label="برند" htmlFor="p-brand" error={formError || undefined}>
              <select
                id="p-brand"
                className="input"
                value={editing.form.brandId}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, brandId: e.target.value } })}
                required
              >
                <option value="">انتخاب کنید…</option>
                {brands?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="نام محصول" htmlFor="p-name">
              <input
                id="p-name"
                className="input"
                value={editing.form.name}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })}
                required
              />
            </Field>
            <Field label="کد محصول (اختیاری)" htmlFor="p-code">
              <input
                id="p-code"
                className="input num"
                value={editing.form.code}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, code: e.target.value } })}
              />
            </Field>
            <Field label="دسته‌بندی (اختیاری)" htmlFor="p-cat">
              <input
                id="p-cat"
                className="input"
                value={editing.form.category}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, category: e.target.value } })}
              />
            </Field>
            <Field label="آدرس تصویر (اختیاری)" htmlFor="p-img" hint="مثلاً /catalog/products/sb-123/main.png">
              <input
                id="p-img"
                className="input"
                value={editing.form.image}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, image: e.target.value } })}
              />
            </Field>
            <Field label="توضیح کوتاه (اختیاری)" htmlFor="p-desc">
              <textarea
                id="p-desc"
                className="input min-h-24"
                value={editing.form.description}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })}
              />
            </Field>
            <Field label="ترتیب نمایش" htmlFor="p-sort">
              <input
                id="p-sort"
                type="number"
                className="input num"
                value={editing.form.sortOrder}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, sortOrder: e.target.value } })}
              />
            </Field>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
