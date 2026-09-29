// اجزای کوچک و مشترک رابط کاربری.
import type { ReactNode } from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { fa } from '../lib/format';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[color:var(--color-ink-soft)]">
      <span
        className="block h-9 w-9 animate-spin rounded-full border-[3px] border-[color:var(--color-line)] border-t-[color:var(--color-brand-500)]"
        role="status"
        aria-label="در حال بارگذاری"
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="card flex flex-col items-center gap-3 p-6 text-center"
      style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
    >
      <AlertCircle size={28} style={{ color: 'var(--color-danger)' }} aria-hidden />
      <p className="font-bold" style={{ color: 'var(--color-danger)' }}>
        {message}
      </p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden />
          تلاش دوباره
        </button>
      )}
    </div>
  );
}

export function EmptyBox({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-8 text-center">
      <Inbox size={30} style={{ color: 'var(--color-ink-soft)' }} aria-hidden />
      <p className="font-bold">{title}</p>
      {hint && <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>{hint}</p>}
    </div>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full">
      <div
        className="bar"
        role="progressbar"
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'پیشرفت'}
      >
        <span style={{ width: `${p}%` }} />
      </div>
      {label && (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-soft)' }}>
          {label}
        </p>
      )}
    </div>
  );
}

/** حلقه‌ی درصد پیشرفت */
export function Ring({ percent, size = 56 }: { percent: number; size?: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * p) / 100}
          style={{ transition: 'stroke-dashoffset .3s ease' }}
        />
      </svg>
      <span className="num absolute text-xs font-bold">{fa(p)}٪</span>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="mb-4">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
