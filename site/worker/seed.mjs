// =====================================================================
//  وارد کردن کاتالوگ واقعی (۱۲ برند و ۲۳۸ محصول) به D1
//    تست محلی:   npm run seed:local
//    روی کلود:   npm run seed:remote
//  idempotent است؛ چند بار اجرا کردن رکورد تکراری نمی‌سازد (INSERT OR IGNORE).
// =====================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../../scripts/lib/catalog-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REMOTE = process.argv.includes('--remote');
const CHUNK = 50; // D1 در هر درخواست محدودیت تعداد statement دارد

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const catalog = loadCatalog();
const now = new Date().toISOString();

const stmts = [];
stmts.push(fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8'));

for (const b of catalog.brands) {
  stmts.push(
    `INSERT OR IGNORE INTO brands (id, name, name_en, logo, sort_order, created_at) VALUES (${q(b.id)}, ${q(b.name)}, ${q(b.nameLatin)}, ${q(b.logoFile ? `/catalog/brands/${b.id}/logo${path.extname(b.logoFile)}` : '')}, ${Number(b.sortOrder) || 0}, ${q(now)});`,
  );
}

let productCount = 0;
// products.csv ستون «ردیف» را در خروجی loadCatalog ندارد؛ ترتیب همان ترتیب فایل است.
for (const p of catalog.products) {
  if (!p.brandId) continue;
  const image = p.imageFile ? `/catalog/products/${p.id}/main${path.extname(p.imageFile)}` : '';
  const sortOrder = Number.isFinite(Number(p.sortOrder)) ? Number(p.sortOrder) : productCount + 1;
  stmts.push(
    `INSERT OR IGNORE INTO products (id, brand_id, name, code, category, image, description, sort_order, created_at) VALUES (${q(p.id)}, ${q(p.brandId)}, ${q(p.name)}, ${q(p.code)}, ${q(p.category)}, ${q(image)}, ${q(p.description)}, ${sortOrder}, ${q(now)});`,
  );
  productCount++;
}

console.log(`[seed] brands=${catalog.brands.length} products=${productCount} statements=${stmts.length}`);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssl-seed-'));
const files = [];
for (let i = 0; i < stmts.length; i += CHUNK) {
  const file = path.join(tmpDir, `chunk-${String(i / CHUNK).padStart(3, '0')}.sql`);
  fs.writeFileSync(file, stmts.slice(i, i + CHUNK).join('\n'), 'utf8');
  files.push(file);
}

// اگر `--persist-to=<path>` داده شود، به همان دیتابیس محلی می‌نویسیم
// (تست‌ها از یک پوشه‌ی جدا استفاده می‌کنند تا به دیتابیس توسعه دست نزنند).
const persistArg = process.argv.find((a) => a.startsWith('--persist-to='));

for (const file of files) {
  const args = ['wrangler', 'd1', 'execute', 'ssl-db'];
  if (REMOTE) args.push('--remote');
  else {
    args.push('--local');
    if (persistArg) args.push(persistArg);
  }
  args.push(`--file=${file}`);
  execFileSync('npx', args, { cwd: HERE, stdio: 'inherit' });
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('[seed] done');
