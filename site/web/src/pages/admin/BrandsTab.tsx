// مدیریت برندها.
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api';
import { Field } from '../../components/ui';
import { SmartImage } from '../../components/SmartImage';
import { DeleteButton, Modal, SectionState, useAdminList } from './shared';
import { fa } from '../../lib/format';

interface Brand {
  id: string;
  name: string;
  name_en: string;
  logo: string;
  sort_order: number;
  product_count: number;
}

interface Form {
  name: string;
  nameEn: string;
  logo: string;
  sortOrder: string;
}

const empty: Form = { name: '', nameEn: '', logo: '', sortOrder: '' };

export default function BrandsTab() {
  const { items, error, refresh } = useAdminList<Brand>('/api/admin/brands');
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError('');
    const payload = {
      name: editing.form.name,
      nameEn: editing.form.nameEn,
      logo: editing.form.logo,
      sortOrder: editing.form.sortOrder === '' ? 0 : Number(editing.form.sortOrder),
    };
    try {
      if (editing.id) await api(`/api/admin/brands/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: payload });
      else await api('/api/admin/brands', { method: 'POST', body: payload });
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
      await api(`/api/admin/brands/${encodeURIComponent(id)}`, { method: 'DELETE' });
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'حذف نشد');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
          {items ? `${fa(items.length)} برند` : '…'}
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ form: empty })}>
          <Plus size={16} aria-hidden />
          افزودن برند
        </button>
      </div>

      <SectionState error={error} loading={!items && !error} onRetry={refresh} />
      {formError && !editing && <p className="err mb-3">{formError}</p>}

      <ul className="flex flex-col gap-2">
        {items?.map((b) => (
          <li key={b.id} className="card flex items-center gap-3 p-3">
            <SmartImage src={b.logo} alt={b.name} className="h-12 w-12 shrink-0 rounded-lg object-contain" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{b.name}</p>
              <p className="num text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                {b.name_en && `${b.name_en} · `}
                {fa(b.product_count)} محصول · ترتیب {fa(b.sort_order)}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setEditing({
                  id: b.id,
                  form: { name: b.name, nameEn: b.name_en ?? '', logo: b.logo ?? '', sortOrder: String(b.sort_order ?? 0) },
                })
              }
            >
              ویرایش
            </button>
            <DeleteButton what={b.name} busy={deleting === b.id} onDelete={() => void remove(b.id)} />
          </li>
        ))}
      </ul>

      {editing && (
        <Modal title={editing.id ? 'ویرایش برند' : 'افزودن برند'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <Field label="نام برند" htmlFor="b-name" error={formError || undefined}>
              <input
                id="b-name"
                className="input"
                value={editing.form.name}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })}
                required
              />
            </Field>
            <Field label="نام لاتین (اختیاری)" htmlFor="b-en">
              <input
                id="b-en"
                className="input"
                value={editing.form.nameEn}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, nameEn: e.target.value } })}
              />
            </Field>
            <Field
              label="آدرس لوگو (اختیاری)"
              htmlFor="b-logo"
              hint="مثلاً /catalog/brands/comeon.png یا یک آدرس کامل اینترنتی"
            >
              <input
                id="b-logo"
                className="input"
                value={editing.form.logo}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, logo: e.target.value } })}
              />
            </Field>
            <Field label="ترتیب نمایش" htmlFor="b-sort" hint="عدد کوچک‌تر، بالاتر نمایش داده می‌شود.">
              <input
                id="b-sort"
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
