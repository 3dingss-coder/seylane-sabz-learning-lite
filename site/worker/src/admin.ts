// سمت ادمین: افزودن برند/محصول/محتوا/آزمون و دیدن وضعیت یادگیری بازاریاب‌ها.
import type { Env, SessionUser } from './auth';
import { nowIso, uuid } from './util';
import { safeQuestions } from './catalog';

const str = (v: unknown, d = '') => (typeof v === 'string' ? v.trim() : d);
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);

// ---------------------------------------------------------------- overview
export async function overview(env: Env) {
  const one = async (sql: string, params: unknown[] = []) => {
    const r = await env.DB.prepare(sql).bind(...params).first<{ n: number }>();
    return r?.n ?? 0;
  };
  const marketers = await one(`SELECT COUNT(*) AS n FROM users WHERE role = 'marketer'`);
  const admins = await one(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`);
  const brands = await one('SELECT COUNT(*) AS n FROM brands');
  const products = await one('SELECT COUNT(*) AS n FROM products');
  const contents = await one('SELECT COUNT(*) AS n FROM contents');
  const quizzes = await one('SELECT COUNT(*) AS n FROM quizzes');
  const completed = await one(`SELECT COUNT(*) AS n FROM progress WHERE status = 'completed'`);

  const startedUsers = await one(
    `SELECT COUNT(DISTINCT user_id) AS n FROM progress WHERE status = 'completed'`,
  );

  // بیشترین محتوای ناقص (برای پیدا کردن جاهایی که بازاریاب‌ها گیر می‌کنند)
  const stuck = await env.DB.prepare(
    `SELECT p.name AS product, c.kind AS kind, c.title AS title, COUNT(*) AS n
       FROM progress pr
       JOIN contents c ON c.id = pr.content_id
       JOIN products p ON p.id = c.product_id
      WHERE pr.status = 'started'
      GROUP BY c.id ORDER BY n DESC LIMIT 5`,
  ).all();

  return {
    marketers,
    admins,
    brands,
    products,
    contents,
    quizzes,
    completed,
    startedUsers,
    stuck: stuck.results,
  };
}

// ---------------------------------------------------------------- برندها
export async function adminBrands(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS product_count
       FROM brands b ORDER BY b.sort_order, b.name`,
  ).all();
  return rows.results;
}

export async function createBrand(env: Env, body: Record<string, unknown>) {
  const name = str(body.name);
  if (!name) return { error: 'نام برند خالی است' };
  const id = str(body.id) || slugId(name);
  await env.DB.prepare(
    'INSERT INTO brands (id, name, name_en, logo, sort_order, created_at) VALUES (?1,?2,?3,?4,?5,?6)',
  )
    .bind(id, name, str(body.nameEn), str(body.logo), num(body.sortOrder, 0), nowIso())
    .run();
  return { id };
}

export async function updateBrand(env: Env, id: string, body: Record<string, unknown>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (typeof body.name === 'string') {
    fields.push('name = ?');
    params.push(body.name.trim());
  }
  if (typeof body.nameEn === 'string') {
    fields.push('name_en = ?');
    params.push(body.nameEn.trim());
  }
  if (typeof body.logo === 'string') {
    fields.push('logo = ?');
    params.push(body.logo.trim());
  }
  if (body.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    params.push(num(body.sortOrder));
  }
  if (!fields.length) return { error: 'چیزی برای تغییر داده نشد' };
  params.push(id);
  await env.DB.prepare(`UPDATE brands SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  return { id };
}

// ---------------------------------------------------------------- محصولات
export async function adminProducts(env: Env, brandId?: string) {
  const base = `SELECT p.*, b.name AS brand_name,
                (SELECT COUNT(*) FROM contents c WHERE c.product_id = p.id) AS content_count
           FROM products p JOIN brands b ON b.id = p.brand_id`;
  const stmt = brandId
    ? env.DB.prepare(`${base} WHERE p.brand_id = ?1 ORDER BY p.sort_order, p.name`).bind(brandId)
    : env.DB.prepare(`${base} ORDER BY b.name, p.sort_order, p.name`);
  const rows = await stmt.all();
  return rows.results;
}

export async function createProduct(env: Env, body: Record<string, unknown>) {
  const brandId = str(body.brandId);
  const name = str(body.name);
  if (!brandId) return { error: 'برند را انتخاب کنید' };
  if (!name) return { error: 'نام محصول خالی است' };
  const brand = await env.DB.prepare('SELECT id FROM brands WHERE id = ?1').bind(brandId).first();
  if (!brand) return { error: 'برند پیدا نشد' };
  const id = str(body.id) || slugId(name);
  await env.DB.prepare(
    `INSERT INTO products (id, brand_id, name, code, category, image, description, sort_order, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
  )
    .bind(
      id,
      brandId,
      name,
      str(body.code),
      str(body.category),
      str(body.image),
      str(body.description),
      num(body.sortOrder, 0),
      nowIso(),
    )
    .run();
  return { id };
}

export async function updateProduct(env: Env, id: string, body: Record<string, unknown>) {
  const map: Record<string, string> = {
    name: 'name',
    code: 'code',
    category: 'category',
    image: 'image',
    description: 'description',
    brandId: 'brand_id',
  };
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (typeof body[k] === 'string') {
      fields.push(`${col} = ?`);
      params.push((body[k] as string).trim());
    }
  }
  if (body.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    params.push(num(body.sortOrder));
  }
  if (!fields.length) return { error: 'چیزی برای تغییر داده نشد' };
  params.push(id);
  await env.DB.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  return { id };
}

// ---------------------------------------------------------------- آزمون‌ها
export async function adminQuizzes(env: Env) {
  const rows = await env.DB.prepare('SELECT * FROM quizzes ORDER BY title').all();
  return rows.results.map((r) => {
    const rec = r as Record<string, unknown>;
    const qs = safeQuestions(rec.questions);
    return { ...rec, questionCount: qs.length, questions: qs };
  });
}

export function parseQuestions(raw: unknown): Question[] | null {
  if (raw === undefined) return null;
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const out: Question[] = [];
  for (const item of arr) {
    const q = str((item as Record<string, unknown>)?.q);
    const options = Array.isArray((item as Record<string, unknown>)?.options)
      ? ((item as Record<string, unknown>).options as unknown[]).map((o) => str(o)).filter(Boolean)
      : [];
    const answer = num((item as Record<string, unknown>)?.answer, 0);
    if (!q || options.length < 2) continue;
    if (answer < 0 || answer >= options.length) return null;
    out.push({ q, options, answer });
  }
  return out;
}
type Question = { q: string; options: string[]; answer: number };

export async function createQuiz(env: Env, body: Record<string, unknown>) {
  const title = str(body.title);
  if (!title) return { error: 'عنوان آزمون خالی است' };
  const questions = parseQuestions(body.questions);
  if (questions === null) return { error: 'سؤال‌ها معتبر نیستند' };
  const list = questions ?? [];
  if (list.length === 0) return { error: 'حداقل یک سؤال با دو گزینه وارد کنید' };
  const id = str(body.id) || slugId(title);
  const passScore = Math.max(1, Math.min(100, num(body.passScore, 70)));
  await env.DB.prepare(
    'INSERT INTO quizzes (id, title, pass_score, questions, created_at) VALUES (?1,?2,?3,?4,?5)',
  )
    .bind(id, title, passScore, JSON.stringify(list), nowIso())
    .run();
  return { id };
}

export async function updateQuiz(env: Env, id: string, body: Record<string, unknown>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (typeof body.title === 'string') {
    fields.push('title = ?');
    params.push(body.title.trim());
  }
  if (body.passScore !== undefined) {
    fields.push('pass_score = ?');
    params.push(Math.max(1, Math.min(100, num(body.passScore, 70))));
  }
  if (body.questions !== undefined) {
    const questions = parseQuestions(body.questions);
    if (questions === null) return { error: 'سؤال‌ها معتبر نیستند' };
    if ((questions ?? []).length === 0) return { error: 'حداقل یک سؤال با دو گزینه وارد کنید' };
    fields.push('questions = ?');
    params.push(JSON.stringify(questions));
  }
  if (!fields.length) return { error: 'چیزی برای تغییر داده نشد' };
  params.push(id);
  await env.DB.prepare(`UPDATE quizzes SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  return { id };
}

// ---------------------------------------------------------------- محتوا
export async function adminContents(env: Env, productId?: string) {
  const base = `SELECT c.*, p.name AS product_name, q.title AS quiz_title
           FROM contents c JOIN products p ON p.id = c.product_id
           LEFT JOIN quizzes q ON q.id = c.quiz_id`;
  const stmt = productId
    ? env.DB.prepare(`${base} WHERE c.product_id = ?1 ORDER BY c.created_at`).bind(productId)
    : env.DB.prepare(`${base} ORDER BY c.created_at DESC LIMIT 300`);
  const rows = await stmt.all();
  return rows.results;
}

export async function createContent(env: Env, body: Record<string, unknown>) {
  const productId = str(body.productId);
  const kind = str(body.kind);
  const title = str(body.title);
  if (!['podcast', 'video', 'quiz'].includes(kind)) return { error: 'نوع محتوا معتبر نیست' };
  if (!productId) return { error: 'محصول را انتخاب کنید' };
  if (!title) return { error: 'عنوان خالی است' };
  const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?1').bind(productId).first();
  if (!product) return { error: 'محصول پیدا نشد' };

  const url = str(body.url);
  const quizId = str(body.quizId);
  if (kind === 'quiz') {
    if (!quizId) return { error: 'یک آزمون انتخاب کنید' };
    const q = await env.DB.prepare('SELECT id FROM quizzes WHERE id = ?1').bind(quizId).first();
    if (!q) return { error: 'آزمون پیدا نشد' };
  } else if (!url) {
    return { error: 'لینک ' + (kind === 'video' ? 'ویدئو' : 'پادکست') + ' خالی است' };
  }

  const id = str(body.id) || slugId(`${productId}-${kind}-${Date.now()}`);
  await env.DB.prepare(
    `INSERT INTO contents (id, product_id, kind, title, url, duration_sec, quiz_id, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
  )
    .bind(
      id,
      productId,
      kind,
      title,
      kind === 'quiz' ? '' : url,
      Math.max(0, num(body.durationSec, 0)),
      kind === 'quiz' ? quizId || null : null,
      nowIso(),
    )
    .run();
  return { id };
}

export async function updateContent(env: Env, id: string, body: Record<string, unknown>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (typeof body.title === 'string') {
    fields.push('title = ?');
    params.push(body.title.trim());
  }
  if (typeof body.url === 'string') {
    fields.push('url = ?');
    params.push(body.url.trim());
  }
  if (body.durationSec !== undefined) {
    fields.push('duration_sec = ?');
    params.push(Math.max(0, num(body.durationSec)));
  }
  if (typeof body.quizId === 'string') {
    fields.push('quiz_id = ?');
    params.push(body.quizId.trim() || null);
  }
  if (!fields.length) return { error: 'چیزی برای تغییر داده نشد' };
  params.push(id);
  await env.DB.prepare(`UPDATE contents SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  return { id };
}

// ---------------------------------------------------------------- گزارش بازاریاب‌ها
export async function listMarketers(env: Env) {
  const users = await env.DB.prepare(
    `SELECT id, first_name, last_name, phone, role, created_at FROM users ORDER BY first_name, last_name`,
  ).all();

  const totals = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM contents`,
  ).first<{ n: number }>();
  const totalContents = totals?.n ?? 0;

  const done = await env.DB.prepare(
    `SELECT user_id, COUNT(*) AS n FROM progress WHERE status = 'completed' GROUP BY user_id`,
  ).all<{ user_id: string; n: number }>();
  const doneMap = new Map(done.results.map((r) => [r.user_id, r.n]));

  const avg = await env.DB.prepare(
    `SELECT user_id, AVG(score) AS s, COUNT(*) AS n FROM quiz_results GROUP BY user_id`,
  ).all<{ user_id: string; s: number; n: number }>();
  const avgMap = new Map(avg.results.map((r) => [r.user_id, { s: Math.round(r.s ?? 0), n: r.n }]));

  const last = await env.DB.prepare(
    `SELECT user_id, MAX(updated_at) AS t FROM progress GROUP BY user_id`,
  ).all<{ user_id: string; t: string }>();
  const lastMap = new Map(last.results.map((r) => [r.user_id, r.t]));

  return users.results.map((u) => {
    const rec = u as Record<string, unknown>;
    const id = String(rec.id);
    const d = doneMap.get(id) ?? 0;
    return {
      id,
      firstName: rec.first_name,
      lastName: rec.last_name,
      phone: rec.phone,
      role: rec.role,
      createdAt: rec.created_at,
      done: d,
      total: totalContents,
      percent: totalContents > 0 ? Math.round((d / totalContents) * 100) : 0,
      quizAvg: avgMap.get(id)?.s ?? null,
      quizCount: avgMap.get(id)?.n ?? 0,
      lastActivity: lastMap.get(id) ?? null,
    };
  });
}

export async function marketerDetail(env: Env, userId: string) {
  const user = await env.DB.prepare(
    'SELECT id, first_name, last_name, phone, role, created_at FROM users WHERE id = ?1',
  )
    .bind(userId)
    .first<Record<string, unknown>>();
  if (!user) return null;

  const items = await env.DB.prepare(
    `SELECT c.id AS content_id, c.kind, c.title, b.name AS brand_name, p.name AS product_name,
            pr.status, pr.percent, pr.updated_at
       FROM contents c
       JOIN products p ON p.id = c.product_id
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN progress pr ON pr.content_id = c.id AND pr.user_id = ?1
      ORDER BY b.name, p.name, c.kind`,
  )
    .bind(userId)
    .all();

  const quizzes = await env.DB.prepare(
    `SELECT qr.score, qr.passed, qr.correct, qr.total, qr.created_at, q.title
       FROM quiz_results qr LEFT JOIN quizzes q ON q.id = qr.quiz_id
      WHERE qr.user_id = ?1 ORDER BY qr.created_at DESC`,
  )
    .bind(userId)
    .all();

  return {
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at,
    },
    items: items.results,
    quizzes: quizzes.results,
  };
}

// ---------------------------------------------------------------- خروجی CSV
/** CSV با BOM تا فارسی در Excel درست نمایش داده شود. */
export function buildCsv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

// ---------------------------------------------------------------- helpers
export async function softDelete(env: Env, table: 'brands' | 'products' | 'contents' | 'quizzes', id: string, user: SessionUser) {
  const allowed = ['brands', 'products', 'contents', 'quizzes'];
  if (!allowed.includes(table)) return { error: 'BAD_TABLE' };
  // حذف محتوا/آزمون از قبل با ON DELETE به progress/quiz_results وصل است.
  const info = await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  void user;
  return { id, deleted: info.meta.changes ?? 0 };
}

/** شناسه‌ی خوانا و یکتا از روی متن (فارسی/لاتین). */
export function slugId(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'item'}-${Math.random().toString(36).slice(2, 8)}`;
}
