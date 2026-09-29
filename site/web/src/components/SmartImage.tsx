// تصویر با مسیر نسبی (سازگار با GitHub Pages) و جایگزین در صورت نبودن فایل.
import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * مسیر asset را به شکل نسبی برمی‌گرداند.
 * با HashRouter و base:'./'، مسیر مطلق «/catalog/...» روی
 * https://user.github.io/repo/ می‌شکند؛ پس «./catalog/...» می‌سازیم.
 */
export function assetUrl(src: string | null | undefined): string {
  if (!src) return '';
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src;
  return src.startsWith('/') ? '.' + src : src;
}

export function SmartImage({
  src,
  alt,
  className = '',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const url = assetUrl(src);

  // React این کامپوننت را بین محصولات بازاستفاده می‌کند؛ اگر آدرس عوض شد
  // باید حالت «خراب» را صفر کنیم، وگرنه تصویر سالم هم جایگزین می‌گیرد.
  useEffect(() => {
    setBroken(false);
  }, [url]);

  if (!url || broken) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ background: 'var(--color-canvas)', color: 'var(--color-ink-soft)' }}
        role="img"
        aria-label={alt || 'بدون تصویر'}
      >
        <ImageOff size={22} aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}
