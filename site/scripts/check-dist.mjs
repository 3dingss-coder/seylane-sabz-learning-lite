// =====================================================================
//  بررسی بیلد نهایی دقیقاً مثل شرایط GitHub Pages:
//  سایت زیر یک «زیرمسیر» سرو می‌شود (https://user.github.io/repo/) و
//  همه‌ی assetها باید با مسیر نسبی درست باز شوند. این همان چیزی است که
//  بیشتر باعث صفحه‌ی سفید روی GitHub Pages می‌شود.
//    اجرا:  npm run build && node ../scripts/check-dist.mjs
// =====================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'web', 'dist');
const SUBPATH = '/repo'; // شبیه‌سازی https://user.github.io/repo/

if (!fs.existsSync(DIST)) {
  console.error('✘ پوشه‌ی dist پیدا نشد. اول npm run build را اجرا کنید.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
  if (!url.startsWith(SUBPATH)) {
    res.writeHead(404).end('not under subpath');
    return;
  }
  let rel = url.slice(SUBPATH.length) || '/';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(DIST, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('missing');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}${SUBPATH}/`;

let failed = 0;
const check = async (label, url, expect = 200) => {
  const res = await fetch(url);
  const ok = res.status === expect;
  if (!ok) failed++;
  console.log(`  ${ok ? '✔' : '✘'} ${label} → ${res.status}`);
  return res;
};

console.log(`\n▸ بررسی بیلد زیر زیرمسیر ${SUBPATH}/ (شبیه GitHub Pages)\n`);

const indexRes = await check('index.html', base);
const html = await indexRes.text();

// ۱) هیچ مسیر مطلقی در HTML نمانده باشد (علت اصلی صفحه‌ی سفید)
const absoluteRefs = [...html.matchAll(/(?:src|href)="(\/[^/"][^"]*)"/g)].map((m) => m[1]);
console.log(`  ${absoluteRefs.length === 0 ? '✔' : '✘'} مسیر مطلق در index.html: ${absoluteRefs.length}`);
if (absoluteRefs.length > 0) {
  console.log('     ' + absoluteRefs.join(', '));
  failed++;
}

// ۲) هر چیزی که HTML به آن ارجاع داده باید ۲۰۰ بدهد
const refs = [...html.matchAll(/(?:src|href)="(\.[^"]+)"/g)].map((m) => m[1]);
for (const ref of refs) {
  await check(ref, new URL(ref, base).href);
}

// ۳) فایل‌های JS/CSS داخل dist هم نباید مسیر مطلق داشته باشند
for (const f of fs.readdirSync(path.join(DIST, 'assets'))) {
  const full = path.join(DIST, 'assets', f);
  if (!/\.(js|css)$/.test(f)) continue;
  const text = fs.readFileSync(full, 'utf8');
  const bad = [...text.matchAll(/["'`]\/(?:assets|catalog|icons)\//g)];
  const ok = bad.length === 0;
  if (!ok) failed++;
  console.log(`  ${ok ? '✔' : '✘'} ${f}: مسیر مطلقِ asset = ${bad.length}`);
}

// ۴) assetهای کاتالوگ باید زیر dist کپی شده باشند
const brandLogo = fs.existsSync(path.join(DIST, 'catalog', 'brands'));
const productImg = fs.existsSync(path.join(DIST, 'catalog', 'products'));
const icons = fs.existsSync(path.join(DIST, 'icons'));
console.log(`  ${brandLogo ? '✔' : '✘'} لوگوی برندها در dist/catalog/brands`);
console.log(`  ${productImg ? '✔' : '✘'} تصاویر محصولات در dist/catalog/products`);
console.log(`  ${icons ? '✔' : '✘'} آیکون‌ها در dist/icons`);
if (!brandLogo || !productImg || !icons) failed += 3;

const logoCount = brandLogo ? fs.readdirSync(path.join(DIST, 'catalog', 'brands')).length : 0;
const imgCount = productImg ? fs.readdirSync(path.join(DIST, 'catalog', 'products')).length : 0;
console.log(`  ${logoCount === 12 ? '✔' : '✘'} ۱۲ لوگوی برند → ${logoCount}`);
console.log(`  ${imgCount === 238 ? '✔' : '✘'} ۲۳۸ تصویر محصول → ${imgCount}`);
if (logoCount !== 12) failed++;
if (imgCount !== 238) failed++;

await check('یک لوگوی واقعی', new URL('./catalog/brands/brand-sb-7/logo.png', base).href);
await check('یک تصویر محصول واقعی', new URL('./catalog/products/sb-300152503/main.png', base).href);
await check('manifest', new URL('./manifest.webmanifest', base).href);

// ۵) RTL و ویوپورت
const rtlOk = /<html[^>]*dir="rtl"/.test(html) && /lang="fa"/.test(html);
const vpOk = /name="viewport"[^>]*width=device-width/.test(html);
console.log(`  ${rtlOk ? '✔' : '✘'} HTML فارسی و راست‌به‌چپ است`);
console.log(`  ${vpOk ? '✔' : '✘'} viewport برای موبایل تنظیم شده`);
if (!rtlOk) failed++;
if (!vpOk) failed++;

server.close();
console.log(`\n${'='.repeat(52)}`);
console.log(failed === 0 ? '✅ بیلد برای GitHub Pages آماده است.' : `❌ ${failed} مشکل پیدا شد.`);
console.log('='.repeat(52));
process.exit(failed === 0 ? 0 : 1);
