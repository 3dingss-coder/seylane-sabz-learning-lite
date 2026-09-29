// پاک‌کردن و ساخت دوباره‌ی دیتابیس محلی توسعه.
// تست‌های رابط کاربری داده‌ی آزمایشی می‌سازند؛ با این دستور پاک می‌شوند.
//   npm run db:reset
//
// توجه: اول باید `npm run dev` را خاموش کنید، وگرنه پوشه‌ی .wrangler
// زیر پای سرور حذف می‌شود و سرور از کار می‌افتد.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(HERE, '.wrangler');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' };

// اگر سروری روی ۸۷۸۷ باشد، یعنی dev در حال اجراست
const busy = await fetch('http://127.0.0.1:8787/api/health')
  .then(() => true)
  .catch(() => false);
if (busy) {
  console.error('\n✘ سرور توسعه روی پورت ۸۷۸۷ در حال اجراست.');
  console.error('  اول آن را خاموش کنید (Ctrl+C در ترمینال npm run dev)، بعد این دستور را بزنید.\n');
  process.exit(1);
}

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: HERE, env, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} → ${c}`))));
  });

console.log('▸ حذف دیتابیس محلی…');
fs.rmSync(STATE, { recursive: true, force: true });

console.log('▸ ساخت جدول‌ها…');
await run('npx', ['wrangler', 'd1', 'execute', 'ssl-db', '--local', '--file=./schema.sql']);

console.log('▸ وارد کردن کاتالوگ…');
await run('node', ['seed.mjs', '--local']);

console.log('\n✅ دیتابیس محلی تمیز شد: ۱۲ برند و ۲۳۸ محصول.');
console.log('   حالا npm run dev را دوباره اجرا کنید.\n');
