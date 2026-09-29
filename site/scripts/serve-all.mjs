// =====================================================================
//  بالا آوردن هم‌زمان Worker و وب‌سایت با یک دستور (برای توسعه و تست مرورگر)
//    node scripts/serve-all.mjs
//  ۱) دیتابیس محلی را migrate و seed می‌کند
//  ۲) Worker را روی ۸۷۸۷ بالا می‌آورد
//  ۳) Vite را روی ۵۱۷۳ بالا می‌آورد (با پروکسی /api)
// =====================================================================
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WORKER = path.join(ROOT, 'worker');
const WEB = path.join(ROOT, 'web');
const API_PORT = Number(process.env.API_PORT ?? 8787);
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const SEED = process.argv.includes('--no-seed') ? false : true;

const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' };
const children = [];

function start(name, cmd, args, cwd, opts = {}) {
  const p = spawn(cmd, args, { cwd, env, stdio: 'inherit', ...opts });
  children.push(p);
  p.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[serve-all] ${name} با کد ${code} بسته شد`);
  });
  return p;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(url, label, timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`[serve-all] ${label} آماده است`);
        return;
      }
    } catch {
      /* هنوز آماده نیست */
    }
    await wait(500);
  }
  throw new Error(`${label} در زمان مقرر آماده نشد`);
}

// ۱) دیتابیس
if (SEED) {
  console.log('[serve-all] ساخت دیتابیس محلی و وارد کردن کاتالوگ…');
  const migrate = spawn(
    'npx',
    ['wrangler', 'd1', 'execute', 'ssl-db', '--local', '--file=./schema.sql'],
    { cwd: WORKER, env, stdio: 'ignore' },
  );
  await new Promise((r) => migrate.on('exit', r));
  const seed = spawn('node', ['seed.mjs', '--local'], { cwd: WORKER, env, stdio: 'inherit' });
  await new Promise((r) => seed.on('exit', r));
}

// ۲) Worker
start('worker', 'npx', ['wrangler', 'dev', '--ip', '0.0.0.0', '--port', String(API_PORT), '--local'], WORKER);
await waitFor(`http://127.0.0.1:${API_PORT}/api/health`, 'API');

// ۳) وب
start('web', 'npx', ['vite', '--host', '0.0.0.0', '--port', String(WEB_PORT)], WEB);
await waitFor(`http://127.0.0.1:${WEB_PORT}/`, 'وب‌سایت');

console.log(`\n  ✅ وب‌سایت: http://localhost:${WEB_PORT}`);
console.log(`  ✅ API:     http://localhost:${API_PORT}/api/health\n`);

function shutdown() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* بی‌اثر */
    }
  }
  setTimeout(() => process.exit(0), 600);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
