// پخش پادکست و ویدئو + ثبت تکمیل.
// لینک‌ها انعطاف‌پذیرند: یوتیوب، آپارات، فایل مستقیم، یا هر آدرس دیگر.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { Shell } from '../components/Shell';
import { ErrorBox, Spinner } from '../components/ui';
import { SmartImage } from '../components/SmartImage';
import { durationFa } from '../lib/format';

interface Content {
  id: string;
  productId: string;
  kind: 'podcast' | 'video' | 'quiz';
  title: string;
  url: string;
  durationSec: number;
  productName: string;
  productImage: string;
  brandId: string;
  brandName: string;
  quiz: unknown;
}

type Player =
  | { type: 'youtube'; id: string }
  | { type: 'aparat'; id: string }
  | { type: 'audio' }
  | { type: 'video' }
  | { type: 'link' };

/** تشخیص نوع پخش‌کننده از روی آدرس */
export function resolvePlayer(url: string, kind: string): Player {
  const u = (url ?? '').trim();
  if (!u) return { type: 'link' };

  const yt =
    u.match(/(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{6,})/) ??
    u.match(/^https?:\/\/(?:www\.)?youtube-nocookie\.com\/embed\/([\w-]{6,})/);
  if (yt?.[1]) return { type: 'youtube', id: yt[1] };

  const aparat = u.match(/aparat\.com\/(?:v|video\/video\/embed\/videohash)\/([A-Za-z0-9]+)/);
  if (aparat?.[1]) return { type: 'aparat', id: aparat[1] };

  const clean = u.split(/[?#]/)[0]?.toLowerCase() ?? '';
  if (/\.(mp3|m4a|aac|ogg|oga|wav|opus|flac)$/.test(clean)) return { type: 'audio' };
  if (/\.(mp4|webm|ogv|mov|m4v)$/.test(clean)) return { type: 'video' };

  // اگر آدرس شناسایی نشد، برای پادکست پخش‌کننده‌ی صوتی و برای ویدئو پخش‌کننده‌ی ویدئویی می‌گذاریم؛
  // اگر مرورگر نتوانست پخش کند، دکمه‌ی «باز کردن در صفحه‌ی جدید» همیشه هست.
  return kind === 'video' ? { type: 'video' } : { type: 'audio' };
}

export default function Learn() {
  const { contentId = '' } = useParams();
  const [data, setData] = useState<Content | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** آخرین ثبت درصد پخش، برای محدودکردن تعداد درخواست‌ها */
  const lastReport = useRef<{ at: number; pct: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setError('');
    setDone(false);
    setNotice('');
    lastReport.current = null;
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

  const player = useMemo(() => (data ? resolvePlayer(data.url, data.kind) : null), [data]);

  const markDone = useCallback(
    async (auto = false) => {
      if (!data || done || saving) return;
      setSaving(true);
      try {
        await api('/api/progress', {
          method: 'POST',
          body: { contentId: data.id, status: 'completed', percent: 100 },
        });
        setDone(true);
        setNotice(auto ? 'پخش تمام شد و به‌عنوان کامل‌شده ثبت شد.' : 'آفرین! به‌عنوان کامل‌شده ثبت شد.');
      } catch (e) {
        setNotice(e instanceof Error ? e.message : 'ثبت نشد. دوباره تلاش کنید.');
      } finally {
        setSaving(false);
      }
    },
    [data, done, saving],
  );

  /**
   * ثبت درصد پخش، تا ادمین ببیند بازاریاب تا کجا گوش داده.
   * رویداد timeupdate چند بار در ثانیه شلیک می‌شود؛ برای اینکه سرور را
   * پر درخواست نکنیم، حداکثر هر ۱۵ ثانیه یک بار و با تغییر حداقل ۵٪ ثبت می‌کنیم.
   */
  const reportPercent = useCallback(() => {
    const el = audioRef.current ?? videoRef.current;
    if (!el || !data || done) return;
    if (!el.duration || !Number.isFinite(el.duration) || el.currentTime < 5) return;

    const percent = Math.round((el.currentTime / el.duration) * 100);
    const now = Date.now();
    if (lastReport.current && now - lastReport.current.at < 15_000 && percent - lastReport.current.pct < 5) {
      return;
    }
    lastReport.current = { at: now, pct: percent };

    void api('/api/progress', {
      method: 'POST',
      body: { contentId: data.id, status: 'started', percent },
    }).catch(() => {
      /* ثبت درصد حیاتی نیست؛ بی‌صدا رد می‌شویم */
    });
  }, [data, done]);

  if (error) {
    return (
      <Shell title="محتوا" back="/brands">
        <ErrorBox message={error} onRetry={() => setReload((n) => n + 1)} />
      </Shell>
    );
  }
  if (!data || !player) {
    return (
      <Shell title="محتوا" back="/brands">
        <Spinner label="در حال بارگذاری…" />
      </Shell>
    );
  }

  const backTo = `/products/${data.productId}`;

  return (
    <Shell title={data.kind === 'video' ? 'ویدئو' : 'پادکست'} back={backTo}>
      <section className="card mb-4 flex items-center gap-3 p-4">
        <SmartImage src={data.productImage} alt={data.productName} className="h-16 w-16 shrink-0 rounded-xl object-contain" />
        <div className="min-w-0">
          <p className="text-xs font-bold" style={{ color: 'var(--color-brand-500)' }}>
            {data.brandName}
          </p>
          <h1 className="truncate text-base font-extrabold">{data.title}</h1>
          {data.durationSec > 0 && (
            <p className="num text-xs" style={{ color: 'var(--color-ink-soft)' }}>
              مدت: {durationFa(data.durationSec)}
            </p>
          )}
        </div>
      </section>

      {/* ---------------- پخش‌کننده ---------------- */}
      <section className="card mb-4 overflow-hidden p-0">
        {player.type === 'youtube' && (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${player.id}?rel=0`}
              title={data.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        )}

        {player.type === 'aparat' && (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.aparat.com/video/video/embed/videohash/${player.id}/vt/frame`}
              title={data.title}
              allowFullScreen
            />
          </div>
        )}

        {player.type === 'audio' && (
          <div className="p-4">
            <audio
              ref={audioRef}
              controls
              preload="metadata"
              className="w-full"
              src={data.url}
              onEnded={() => void markDone(true)}
              onTimeUpdate={() => void reportPercent()}
            >
              مرورگر شما پخش صوت را پشتیبانی نمی‌کند.
            </audio>
          </div>
        )}

        {player.type === 'video' && (
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            className="max-h-[70vh] w-full bg-black"
            src={data.url}
            onEnded={() => void markDone(true)}
            onTimeUpdate={() => void reportPercent()}
          >
            مرورگر شما پخش ویدئو را پشتیبانی نمی‌کند.
          </video>
        )}

        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-center gap-2 border-t p-3 text-sm font-bold"
            style={{ borderColor: 'var(--color-line)', color: 'var(--color-brand-500)' }}
          >
            <ExternalLink size={16} aria-hidden />
            اگر بالا نیامد، در صفحه‌ی جدید باز کنید
          </a>
        )}
      </section>

      {/* ---------------- ثبت تکمیل ---------------- */}
      {done ? (
        <div className="card p-5 text-center" style={{ background: 'var(--color-ok-soft)', borderColor: 'var(--color-ok)' }}>
          <CheckCircle2 size={34} style={{ color: 'var(--color-ok)' }} aria-hidden />
          <p className="mt-2 font-extrabold" style={{ color: 'var(--color-ok)' }}>
            {notice || 'کامل شد'}
          </p>
          <Link to={backTo} className="btn btn-primary btn-sm mt-4">
            بازگشت به محصول
          </Link>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void markDone(false)}
            disabled={saving}
          >
            {saving ? 'در حال ثبت…' : data.kind === 'video' ? 'ویدئو را دیدم ✓' : 'پادکست را گوش دادم ✓'}
          </button>
          <p className="mt-2 text-center text-xs" style={{ color: 'var(--color-ink-soft)' }}>
            بعد از تمام‌شدن، این دکمه را بزنید تا در پیشرفت شما ثبت شود.
          </p>
          {notice && (
            <p className="err mt-2 text-center" role="alert">
              {notice}
            </p>
          )}
        </>
      )}
    </Shell>
  );
}
