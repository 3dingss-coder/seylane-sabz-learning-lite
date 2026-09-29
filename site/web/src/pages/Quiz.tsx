// آزمون — سؤال به سؤال، سپس نتیجه و مرور پاسخ‌ها.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ErrorBox, ProgressBar, Spinner } from '../components/ui';
import { fa } from '../lib/format';

interface Question {
  q: string;
  options: string[];
}

interface Content {
  id: string;
  productId: string;
  title: string;
  productName: string;
  brandName: string;
  quiz: { id: string; title: string; passScore: number; questions: Question[] } | null;
}

interface Review {
  q: string;
  options: string[];
  given: number;
  answer: number;
  right: boolean;
}

interface Result {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  passScore: number;
  review: Review[];
}

export default function Quiz() {
  const { contentId = '' } = useParams();
  const [data, setData] = useState<Content | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    setResult(null);
    setStep(0);
    setAnswers([]);
    api<Content>(`/api/contents/${encodeURIComponent(contentId)}`)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [contentId, reload]);

  const questions = data?.quiz?.questions ?? [];
  const current = questions[step];

  const submit = useCallback(async (finalAnswers: number[]) => {
    setBusy(true);
    try {
      const res = await api<Result>('/api/quiz-submit', {
        method: 'POST',
        body: { contentId, answers: finalAnswers },
      });
      setResult(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت آزمون ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }, [contentId]);

  function pick(index: number) {
    if (result) return;
    const next = [...answers];
    next[step] = index;
    setAnswers(next);
  }

  if (error) {
    return (
      <Shell title="آزمون" back="/brands">
        <ErrorBox message={error} onRetry={() => setReload((n) => n + 1)} />
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell title="آزمون" back="/brands">
        <Spinner label="در حال بارگذاری آزمون…" />
      </Shell>
    );
  }

  const backTo = `/products/${data.productId}`;

  if (!data.quiz || questions.length === 0) {
    return (
      <Shell title="آزمون" back={backTo}>
        <p className="card p-6 text-center">این آزمون هنوز سؤالی ندارد.</p>
        <Link to={backTo} className="btn btn-ghost btn-block mt-4">
          بازگشت به محصول
        </Link>
      </Shell>
    );
  }

  // ---------------- صفحه‌ی نتیجه ----------------
  if (result) {
    return (
      <Shell title="نتیجه‌ی آزمون" back={backTo}>
        <section
          className="card mb-4 p-6 text-center"
          style={{
            background: result.passed ? 'var(--color-ok-soft)' : 'var(--color-warn-soft)',
            borderColor: result.passed ? 'var(--color-ok)' : 'var(--color-warn)',
          }}
        >
          {result.passed ? (
            <CheckCircle2 size={44} style={{ color: 'var(--color-ok)' }} aria-hidden />
          ) : (
            <XCircle size={44} style={{ color: 'var(--color-warn)' }} aria-hidden />
          )}
          <p className="num mt-2 text-4xl font-extrabold">{fa(result.score)}٪</p>
          <p className="mt-1 font-extrabold">
            {result.passed ? 'قبول شدید، آفرین!' : 'قبول نشدید'}
          </p>
          <p className="num mt-1 text-sm" style={{ color: 'var(--color-ink-soft)' }}>
            {fa(result.correct)} پاسخ درست از {fa(result.total)} سؤال — حد نصاب {fa(result.passScore)}٪
          </p>
        </section>

        <h2 className="mb-2 font-extrabold">مرور پاسخ‌ها</h2>
        <ol className="flex flex-col gap-3">
          {result.review.map((r, i) => (
            <li key={i} className="card p-4">
              <p className="mb-2 font-bold">
                <span className="num">{fa(i + 1)}. </span>
                {r.q}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {r.options.map((opt, j) => {
                  const isAnswer = j === r.answer;
                  const isGiven = j === r.given;
                  return (
                    <li
                      key={j}
                      className="flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{
                        background: isAnswer ? 'var(--color-ok-soft)' : isGiven ? 'var(--color-danger-soft)' : 'transparent',
                        fontWeight: isAnswer || isGiven ? 700 : 400,
                      }}
                    >
                      {isAnswer && <CheckCircle2 size={16} style={{ color: 'var(--color-ok)' }} aria-hidden />}
                      {isGiven && !isAnswer && <XCircle size={16} style={{ color: 'var(--color-danger)' }} aria-hidden />}
                      <span>{opt}</span>
                      {isAnswer && (
                        <span className="mr-auto text-xs" style={{ color: 'var(--color-ok)' }}>
                          پاسخ درست
                        </span>
                      )}
                      {isGiven && !isAnswer && (
                        <span className="mr-auto text-xs" style={{ color: 'var(--color-danger)' }}>
                          انتخاب شما
                        </span>
                      )}
                    </li>
                  );
                })}
                {r.given < 0 && (
                  <li className="px-3 py-1 text-xs" style={{ color: 'var(--color-ink-soft)' }}>
                    به این سؤال پاسخ ندادید.
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              setResult(null);
              setStep(0);
              setAnswers([]);
              window.scrollTo({ top: 0 });
            }}
          >
            دوباره آزمون می‌دهم
          </button>
          <Link to={backTo} className="btn btn-primary btn-block">
            بازگشت به محصول
          </Link>
        </div>
      </Shell>
    );
  }

  // ---------------- صفحه‌ی سؤال ----------------
  const answeredAll = answers.length === questions.length && answers.every((a) => Number.isInteger(a));

  return (
    <Shell title={data.quiz.title} back={backTo}>
      <div className="mb-4">
        <ProgressBar
          percent={((step + (Number.isInteger(answers[step]) ? 1 : 0)) / questions.length) * 100}
          label={`سؤال ${fa(step + 1)} از ${fa(questions.length)}`}
        />
      </div>

      <section className="card p-5">
        <p className="mb-1 text-xs font-bold" style={{ color: 'var(--color-brand-500)' }}>
          {data.brandName} — {data.productName}
        </p>
        <h1 className="mb-4 text-lg font-extrabold leading-relaxed">{current?.q}</h1>

        <div className="flex flex-col gap-2" role="radiogroup" aria-label={current?.q}>
          {current?.options.map((opt, i) => {
            const selected = answers[step] === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => pick(i)}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border p-3 text-right text-sm font-bold transition"
                style={{
                  borderColor: selected ? 'var(--color-brand-500)' : 'var(--color-line)',
                  background: selected ? 'var(--color-brand-50)' : '#fff',
                  color: selected ? 'var(--color-brand-600)' : 'var(--color-ink)',
                }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs"
                  style={{
                    borderColor: selected ? 'var(--color-brand-500)' : 'var(--color-line)',
                    background: selected ? 'var(--color-brand-500)' : '#fff',
                    color: selected ? '#fff' : 'var(--color-ink-soft)',
                  }}
                  aria-hidden
                >
                  {['۱', '۲', '۳', '۴', '۵', '۶'][i] ?? fa(i + 1)}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-5 flex gap-3">
        {step > 0 && (
          <button type="button" className="btn btn-ghost flex-1" onClick={() => setStep((s) => s - 1)}>
            سؤال قبلی
          </button>
        )}
        {step < questions.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => setStep((s) => s + 1)}
            disabled={!Number.isInteger(answers[step])}
          >
            سؤال بعدی
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => void submit(answers)}
            disabled={busy || !answeredAll}
          >
            {busy ? 'در حال تصحیح…' : 'ثبت و دیدن نتیجه'}
          </button>
        )}
      </div>

      {!Number.isInteger(answers[step]) && (
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--color-ink-soft)' }}>
          برای رفتن به سؤال بعد، یک گزینه را انتخاب کنید.
        </p>
      )}
    </Shell>
  );
}
