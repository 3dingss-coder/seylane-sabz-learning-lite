// ساخت و ویرایش آزمون‌ها با ویرایشگر سؤال.
import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api';
import { Field } from '../../components/ui';
import { DeleteButton, Modal, SectionState, useAdminList } from './shared';
import { fa } from '../../lib/format';

interface Quiz {
  id: string;
  title: string;
  pass_score: number;
  questionCount: number;
  questions: { q: string; options: string[]; answer: number }[];
}

interface QDraft {
  q: string;
  options: string[];
  answer: number;
}

const blankQuestion = (): QDraft => ({ q: '', options: ['', ''], answer: 0 });

export default function QuizzesTab() {
  const { items, error, refresh } = useAdminList<Quiz>('/api/admin/quizzes');
  const [editing, setEditing] = useState<{ id?: string; title: string; passScore: string; questions: QDraft[] } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  function setQ(index: number, patch: Partial<QDraft>) {
    if (!editing) return;
    const next = editing.questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    setEditing({ ...editing, questions: next });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError('');

    const questions = editing.questions
      .map((q) => ({ q: q.q.trim(), options: q.options.map((o) => o.trim()).filter(Boolean), answer: q.answer }))
      .filter((q) => q.q && q.options.length >= 2 && q.answer < q.options.length);

    if (questions.length === 0) {
      setFormError('حداقل یک سؤال با دو گزینه وارد کنید.');
      setBusy(false);
      return;
    }

    const payload = {
      title: editing.title,
      passScore: editing.passScore === '' ? 70 : Number(editing.passScore),
      questions,
    };
    try {
      if (editing.id) await api(`/api/admin/quizzes/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: payload });
      else await api('/api/admin/quizzes', { method: 'POST', body: payload });
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
      await api(`/api/admin/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
          {items ? `${fa(items.length)} آزمون` : '…'}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setEditing({ title: '', passScore: '70', questions: [blankQuestion()] })}
        >
          <Plus size={16} aria-hidden />
          ساخت آزمون
        </button>
      </div>

      <SectionState error={error} loading={!items && !error} onRetry={refresh} />
      {formError && !editing && <p className="err mb-3">{formError}</p>}
      {items && items.length === 0 && (
        <p className="card p-6 text-center">هنوز آزمونی ساخته نشده است.</p>
      )}

      <ul className="flex flex-col gap-2">
        {items?.map((q) => (
          <li key={q.id} className="card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{q.title}</p>
              <p className="num text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                {fa(q.questionCount)} سؤال · حد نصاب {fa(q.pass_score)}٪
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setEditing({
                  id: q.id,
                  title: q.title,
                  passScore: String(q.pass_score),
                  questions: (q.questions ?? []).map((x) => ({ q: x.q, options: [...x.options], answer: x.answer })),
                })
              }
            >
              ویرایش
            </button>
            <DeleteButton what={q.title} busy={deleting === q.id} onDelete={() => void remove(q.id)} />
          </li>
        ))}
      </ul>

      {editing && (
        <Modal title={editing.id ? 'ویرایش آزمون' : 'ساخت آزمون'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <Field label="عنوان آزمون" htmlFor="q-title" error={formError || undefined}>
              <input
                id="q-title"
                className="input"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
              />
            </Field>
            <Field label="حد نصاب قبولی (درصد)" htmlFor="q-pass" hint="مثلاً ۷۰ یعنی بازاریاب باید ۷۰٪ درست پاسخ دهد.">
              <input
                id="q-pass"
                type="number"
                min="1"
                max="100"
                className="input num"
                value={editing.passScore}
                onChange={(e) => setEditing({ ...editing, passScore: e.target.value })}
              />
            </Field>

            <fieldset className="mb-4">
              <legend className="label">سؤال‌ها</legend>
              <div className="flex flex-col gap-4">
                {editing.questions.map((q, qi) => (
                  <div key={qi} className="card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="num text-sm font-extrabold">سؤال {fa(qi + 1)}</p>
                      {editing.questions.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setEditing({ ...editing, questions: editing.questions.filter((_, i) => i !== qi) })
                          }
                          aria-label={`حذف سؤال ${fa(qi + 1)}`}
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      )}
                    </div>
                    <input
                      className="input mb-2"
                      placeholder="متن سؤال"
                      value={q.q}
                      onChange={(e) => setQ(qi, { q: e.target.value })}
                      aria-label={`متن سؤال ${fa(qi + 1)}`}
                    />
                    <div className="flex flex-col gap-2">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`answer-${qi}`}
                            className="h-5 w-5 shrink-0"
                            checked={q.answer === oi}
                            onChange={() => setQ(qi, { answer: oi })}
                            aria-label={`گزینه‌ی درست سؤال ${fa(qi + 1)}`}
                          />
                          <input
                            className="input flex-1"
                            placeholder={`گزینه‌ی ${fa(oi + 1)}`}
                            value={opt}
                            onChange={(e) => {
                              const options = q.options.map((o, i) => (i === oi ? e.target.value : o));
                              setQ(qi, { options });
                            }}
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                const options = q.options.filter((_, i) => i !== oi);
                                setQ(qi, { options, answer: Math.min(q.answer, options.length - 1) });
                              }}
                              aria-label={`حذف گزینه‌ی ${fa(oi + 1)}`}
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          )}
                        </label>
                      ))}
                    </div>
                    <p className="hint">گزینه‌ای که دایره‌اش را پر کنید، پاسخ درست است.</p>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-2"
                      onClick={() => setQ(qi, { options: [...q.options, ''] })}
                    >
                      <Plus size={14} aria-hidden />
                      افزودن گزینه
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-3"
                onClick={() => setEditing({ ...editing, questions: [...editing.questions, blankQuestion()] })}
              >
                <Plus size={14} aria-hidden />
                افزودن سؤال
              </button>
            </fieldset>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'در حال ذخیره…' : 'ذخیره‌ی آزمون'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
