// کپی لوگوی برندها و تصویر محصولات واقعی به public/catalog تا روی GitHub Pages
// مستقیم سرو شوند (رایگان، بدون نیاز به R2). فایل‌های اصلی دست‌نخورده در ریشه‌ی ریپو می‌مانند.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOGOS_DIR,
  PRODUCT_IMAGES_DIR,
  UI_KIT_DIR,
  loadCatalog,
} from '../../../scripts/lib/catalog-source.mjs';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(WEB_ROOT, 'public', 'catalog');
const ICONS_OUT = path.join(WEB_ROOT, 'public', 'icons');

function copyIfChanged(src, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

const catalog = loadCatalog();
let copied = 0;

for (const b of catalog.brands.filter((x) => x.logoFile)) {
  const ext = path.extname(b.logoFile);
  if (copyIfChanged(path.join(LOGOS_DIR, b.logoFile), path.join(OUT, `brands/${b.id}/logo${ext}`))) copied++;
}

for (const p of catalog.products.filter((x) => x.imageFile)) {
  const ext = path.extname(p.imageFile);
  if (copyIfChanged(path.join(PRODUCT_IMAGES_DIR, p.imageFile), path.join(OUT, `products/${p.id}/main${ext}`))) copied++;
}

// آیکون و لوگوی خود اپ
const iconSrc = path.join(UI_KIT_DIR, 'اپ مشتری', 'لوگو و آیکون');
if (fs.existsSync(iconSrc)) {
  for (const f of ['icon-192.png', 'icon-512.png', 'logo-full.png', 'logo-mark-transparent.png']) {
    const src = path.join(iconSrc, f);
    if (fs.existsSync(src) && copyIfChanged(src, path.join(ICONS_OUT, f))) copied++;
  }
}

console.info(
  `[sync-assets] brands=${catalog.brands.length} products=${catalog.products.length} copied=${copied}`,
);
