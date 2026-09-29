-- =====================================================================
--  سیلانه‌سبز لرنینگ — ساختار دیتابیس (Cloudflare D1 / SQLite)
--  اجرا:  npm run db:migrate:remote   (و برای تست محلی: db:migrate:local)
--  این فایل idempotent است؛ چند بار اجرا کردنش مشکلی ایجاد نمی‌کند.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------- کاربران (بازاریاب‌ها و ادمین‌ها) ----------
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  phone       TEXT NOT NULL UNIQUE,           -- همیشه به شکل نرمال‌شده: 09xxxxxxxxx
  role        TEXT NOT NULL DEFAULT 'marketer' CHECK (role IN ('marketer','admin')),
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ---------- برندها ----------
CREATE TABLE IF NOT EXISTS brands (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_en     TEXT DEFAULT '',
  logo        TEXT DEFAULT '',                -- مسیر نسبی روی سایت یا آدرس کامل
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brands_sort ON brands(sort_order, name);

-- ---------- محصولات ----------
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT DEFAULT '',
  category    TEXT DEFAULT '',
  image       TEXT DEFAULT '',
  description TEXT DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id, sort_order, name);

-- ---------- آزمون‌ها ----------
-- questions یک آرایه‌ی JSON است:
-- [{ "q": "سؤال", "options": ["الف","ب","ج","د"], "answer": 1 }]
-- answer شماره‌ی گزینه‌ی درست است (از صفر).
CREATE TABLE IF NOT EXISTS quizzes (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  pass_score  INTEGER NOT NULL DEFAULT 70,    -- درصد قبولی
  questions   TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL
);

-- ---------- محتوا: پادکست / ویدئو / آزمون ----------
-- url      → برای پادکست و ویدئو (لینک یوتیوب، آپارات، یا فایل مستقیم)
-- quiz_id  → برای آزمون
CREATE TABLE IF NOT EXISTS contents (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('podcast','video','quiz')),
  title         TEXT NOT NULL,
  url           TEXT DEFAULT '',
  duration_sec  INTEGER NOT NULL DEFAULT 0,
  quiz_id       TEXT REFERENCES quizzes(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contents_product ON contents(product_id, kind);

-- ---------- وضعیت یادگیری هر بازاریاب روی هر محتوا ----------
CREATE TABLE IF NOT EXISTS progress (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id  TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed')),
  percent     INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);

-- ---------- نتایج آزمون ----------
CREATE TABLE IF NOT EXISTS quiz_results (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id  TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  quiz_id     TEXT NOT NULL,
  score       INTEGER NOT NULL,               -- درصد ۰ تا ۱۰۰
  passed      INTEGER NOT NULL DEFAULT 0,     -- 0 یا 1
  correct     INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON quiz_results(user_id, created_at);
