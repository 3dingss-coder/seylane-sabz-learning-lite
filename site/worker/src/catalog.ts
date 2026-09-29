// خواندن کاتالوگ (برندها، محصولات، محتوا) برای سمت بازاریاب.
import type { Env } from './auth';

export interface Counts {
  /** product_id → تعداد کل آیتم‌های محتوایی */
  total: Map<string, number>;
  /** product_id → تعداد آیتم‌های تکمیل‌شده توسط کاربر */
  done: Map<string, number>;
}

/** شمارش محتواها و پیشرفت کاربر در دو کوئری. */
export async function countsFor(env: Env, userId: string | null): Promise<Counts> {
  const totalRows = await env.DB.prepare(
    'SELECT product_id, COUNT(*) AS n FROM contents GROUP BY product_id',
  ).all<{ product_id: string; n: number }>();

  const done = new Map<string, number>();
  if (userId) {
    const doneRows = await env.DB.prepare(
      `SELECT c.product_id AS product_id, COUNT(*) AS n
         FROM progress pr
         JOIN contents c ON c.id = pr.content_id
        WHERE pr.user_id = ?1 AND pr.status = 'completed'
        GROUP BY c.product_id`,
    )
      .bind(userId)
      .all<{ product_id: string; n: number }>();
    for (const r of doneRows.results) done.set(r.product_id, r.n);
  }
  return {
    total: new Map(totalRows.results.map((r) => [r.product_id, r.n])),
    done,
  };
}

/** درصد پیشرفت یک محصول (۰ تا ۱۰۰). محصول بدون محتوا = ۰٪ و کامل‌شده حساب نمی‌شود. */
export function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/** لیست برندها + تعداد محصولات + پیشرفت کاربر */
export async function listBrands(env: Env, userId: string | null) {
  const brands = await env.DB.prepare(
    `SELECT id, name, name_en, logo, sort_order FROM brands ORDER BY sort_order, name`,
  ).all<Record<string, unknown>>();

  const products = await env.DB.prepare(
    'SELECT id, brand_id FROM products',
  ).all<{ id: string; brand_id: string }>();

  const counts = await countsFor(env, userId);

  const perBrand = new Map<string, { total: number; done: number; products: number; doneProducts: number }>();
  for (const b of brands.results) {
    perBrand.set(String(b.id), { total: 0, done: 0, products: 0, doneProducts: 0 });
  }
  for (const p of products.results) {
    const agg = perBrand.get(p.brand_id);
    if (!agg) continue;
    agg.products += 1;
    const t = counts.total.get(p.id) ?? 0;
    const d = counts.done.get(p.id) ?? 0;
    agg.total += t;
    agg.done += d;
    if (t > 0 && d >= t) agg.doneProducts += 1;
  }

  return brands.results.map((b) => {
    const agg = perBrand.get(String(b.id))!;
    return {
      id: b.id,
      name: b.name,
      nameEn: b.name_en ?? '',
      logo: b.logo ?? '',
      productCount: agg.products,
      done: agg.done,
      total: agg.total,
      percent: pct(agg.done, agg.total),
      doneProducts: agg.doneProducts,
    };
  });
}

/** محصولات یک برند + پیشرفت کاربر */
export async function listProducts(env: Env, brandId: string, userId: string | null) {
  const brand = await env.DB.prepare('SELECT id, name, name_en, logo FROM brands WHERE id = ?1')
    .bind(brandId)
    .first<Record<string, unknown>>();
  if (!brand) return null;

  const products = await env.DB.prepare(
    `SELECT id, name, code, category, image, sort_order
       FROM products WHERE brand_id = ?1 ORDER BY sort_order, name`,
  )
    .bind(brandId)
    .all<Record<string, unknown>>();

  const counts = await countsFor(env, userId);

  return {
    brand: { id: brand.id, name: brand.name, nameEn: brand.name_en ?? '', logo: brand.logo ?? '' },
    products: products.results.map((p) => {
      const total = counts.total.get(String(p.id)) ?? 0;
      const done = counts.done.get(String(p.id)) ?? 0;
      return {
        id: p.id,
        name: p.name,
        code: p.code ?? '',
        category: p.category ?? '',
        image: p.image ?? '',
        done,
        total,
        percent: pct(done, total),
      };
    }),
  };
}

/** جزئیات یک محصول + سه دسته محتوای آن + وضعیت کاربر */
export async function productDetail(env: Env, productId: string, userId: string | null) {
  const product = await env.DB.prepare(
    `SELECT p.id, p.name, p.code, p.category, p.image, p.description,
            b.id AS brand_id, b.name AS brand_name, b.logo AS brand_logo
       FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.id = ?1`,
  )
    .bind(productId)
    .first<Record<string, unknown>>();
  if (!product) return null;

  const contents = await env.DB.prepare(
    `SELECT id, kind, title, url, duration_sec, quiz_id, created_at
       FROM contents WHERE product_id = ?1 ORDER BY created_at`,
  )
    .bind(productId)
    .all<Record<string, unknown>>();

  const myProgress = new Map<string, { status: string; percent: number }>();
  if (userId) {
    const rows = await env.DB.prepare(
      'SELECT content_id, status, percent FROM progress WHERE user_id = ?1',
    )
      .bind(userId)
      .all<{ content_id: string; status: string; percent: number }>();
    for (const r of rows.results) myProgress.set(r.content_id, { status: r.status, percent: r.percent });
  }

  const items = contents.results.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    url: c.url ?? '',
    durationSec: c.duration_sec ?? 0,
    completed: myProgress.get(String(c.id))?.status === 'completed',
  }));

  return {
    product: {
      id: product.id,
      name: product.name,
      code: product.code ?? '',
      category: product.category ?? '',
      image: product.image ?? '',
      description: product.description ?? '',
      brandId: product.brand_id,
      brandName: product.brand_name,
      brandLogo: product.brand_logo ?? '',
    },
    items,
    total: items.length,
    done: items.filter((i) => i.completed).length,
  };
}

/** یک آیتم محتوا؛ برای آزمون، سؤال‌ها بدون پاسخ درست برگردانده می‌شوند. */
export async function contentDetail(env: Env, contentId: string) {
  const c = await env.DB.prepare(
    `SELECT c.id, c.product_id, c.kind, c.title, c.url, c.duration_sec, c.quiz_id,
            p.name AS product_name, p.image AS product_image,
            b.id AS brand_id, b.name AS brand_name
       FROM contents c
       JOIN products p ON p.id = c.product_id
       JOIN brands b ON b.id = p.brand_id
      WHERE c.id = ?1`,
  )
    .bind(contentId)
    .first<Record<string, unknown>>();
  if (!c) return null;

  let quiz: null | { id: string; title: string; passScore: number; questions: unknown[] } = null;
  if (c.quiz_id) {
    const q = await env.DB.prepare('SELECT id, title, pass_score, questions FROM quizzes WHERE id = ?1')
      .bind(c.quiz_id)
      .first<{ id: string; title: string; pass_score: number; questions: string }>();
    if (q) {
      const parsed = safeQuestions(q.questions);
      // پاسخ درست هرگز به کلاینت فرستاده نمی‌شود.
      quiz = {
        id: q.id,
        title: q.title,
        passScore: q.pass_score,
        questions: parsed.map((item) => ({ q: item.q, options: item.options })),
      };
    }
  }

  return {
    id: c.id,
    productId: c.product_id,
    kind: c.kind,
    title: c.title,
    url: c.url ?? '',
    durationSec: c.duration_sec ?? 0,
    productName: c.product_name,
    productImage: c.product_image ?? '',
    brandId: c.brand_id,
    brandName: c.brand_name,
    quiz,
  };
}

export interface Question {
  q: string;
  options: string[];
  answer: number;
}

export function safeQuestions(raw: unknown): Question[] {
  try {
    const arr = JSON.parse(typeof raw === 'string' ? raw : '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.q === 'string')
      .map((x) => ({
        q: String(x.q),
        options: Array.isArray(x.options) ? x.options.map((o: unknown) => String(o)) : [],
        answer: Number.isInteger(x.answer) ? Number(x.answer) : 0,
      }));
  } catch {
    return [];
  }
}
