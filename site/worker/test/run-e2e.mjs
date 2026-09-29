// اجراگر تست یکپارچگی: دیتابیس تمیز → schema → seed → بالا آوردن Worker → اجرای تست → خاموش کردن.
//   npm run test:e2e
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.E2E_PORT ?? 8787);
const BASE = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' };

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, env, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args[0]} → ${code}`))));
  });

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* هنوز بالا نیامده */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Worker در زمان مقرر بالا نیامد');
}

// ۱. دیتابیس محلی تمیز
fs.rmSync(path.join(ROOT, '.wrangler'), { recursive: true, force: true });
await run('npx', ['wrangler', 'd1', 'execute', 'ssl-db', '--local', '--file=./schema.sql']);

// ۲. کاتالوگ واقعی
await run('node', ['seed.mjs', '--local']);

// ۳. Worker
// detached: true → wrangler در گروه پروسه‌ی خودش اجرا می‌شود تا بتوانیم
// workerd (پروسه‌ی فرزندش) را هم با هم خاموش کنیم؛ وگرنه پورت اشغال می‌ماند.
const worker = spawn('npx', ['wrangler', 'dev', '--ip', '127.0.0.1', '--port', String(PORT), '--local'], {
  cwd: ROOT,
  env,
  stdio: 'ignore',
  detached: true,
});

function killTree(p) {
  if (p.pid === undefined) return;
  try {
    process.kill(-p.pid, 'SIGTERM');
  } catch {
    try {
      p.kill('SIGTERM');
    } catch {
      /* بی‌اثر */
    }
  }
}

let code = 1;
try {
  await waitForServer();
  code = await new Promise((resolve) => {
    const t = spawn('node', ['test/e2e.mjs'], { cwd: ROOT, env: { ...env, BASE_URL: BASE }, stdio: 'inherit' });
    t.on('exit', (c) => resolve(c ?? 1));
  });
} finally {
  killTree(worker);
  await new Promise((r) => setTimeout(r, 1200));
  if (worker.pid !== undefined) {
    try {
      process.kill(-worker.pid, 'SIGKILL');
    } catch {
      /* بی‌اثر */
    }
  }
}
process.exit(code);
