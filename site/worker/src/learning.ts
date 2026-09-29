// ثبت پیشرفت و تصحیح آزمون.
import type { Env, SessionUser } from './auth';
import { nowIso, uuid } from './util';
import { safeQuestions } from './catalog';

/** ثبت یا به‌روزرسانی پیشرفت یک آیتم محتوا. */
export async function saveProgress(
  env: Env,
  user: SessionUser,
  input: { contentId?: string; percent?: number; status?: string },
): Promise<{ ok: true; status: string; percent: number } | { ok: false; error: string }> {
  const contentId = String(input.contentId ?? '').trim();
  if (!contentId) return { ok: false, error: 'MISSING_CONTENT' };

  const exists = await env.DB.prepare('SELECT id FROM contents WHERE id = ?1')
    .bind(contentId)
    .first();
  if (!exists) return { ok: false, error: 'CONTENT_NOT_FOUND' };

  const rawStatus = input.status === 'completed' ? 'completed' : 'started';
  const rawPercent = Math.max(0, Math.min(100, Math.round(Number(input.percent ?? 0) || 0)));
  // اگر کامل شده، درصد ۱۰۰ است.
  const status = rawStatus;
  const percent = status === 'completed' ? 100 : rawPercent;

  await env.DB.prepare(
    `INSERT INTO progress (user_id, content_id, status, percent, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(user_id, content_id) DO UPDATE SET
       status = excluded.status,
       percent = MAX(progress.percent, excluded.percent),
       updated_at = excluded.updated_at`,
  )
    .bind(user.id, contentId, status, percent, nowIso())
    .run();

  return { ok: true, status, percent };
}

/** تصحیح آزمون: answers آرایه‌ای از شماره‌ی گزینه‌ی انتخابی برای هر سؤال است. */
export async function gradeQuiz(
  env: Env,
  user: SessionUser,
  input: { contentId?: string; answers?: unknown },
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      score: number;
      passed: boolean;
      correct: number;
      total: number;
      passScore: number;
      review: { q: string; options: string[]; given: number; answer: number; right: boolean }[];
    }
> {
  const contentId = String(input.contentId ?? '').trim();
  if (!contentId) return { ok: false, error: 'MISSING_CONTENT' };

  const content = await env.DB.prepare('SELECT id, quiz_id FROM contents WHERE id = ?1')
    .bind(contentId)
    .first<{ id: string; quiz_id: string | null }>();
  if (!content) return { ok: false, error: 'CONTENT_NOT_FOUND' };
  if (!content.quiz_id) return { ok: false, error: 'NOT_A_QUIZ' };

  const quiz = await env.DB.prepare('SELECT id, title, pass_score, questions FROM quizzes WHERE id = ?1')
    .bind(content.quiz_id)
    .first<{ id: string; title: string; pass_score: number; questions: string }>();
  if (!quiz) return { ok: false, error: 'QUIZ_NOT_FOUND' };

  const questions = safeQuestions(quiz.questions);
  if (questions.length === 0) return { ok: false, error: 'QUIZ_EMPTY' };

  const given = Array.isArray(input.answers) ? input.answers.map((a) => Number(a)) : [];
  let correct = 0;
  const review = questions.map((item, i) => {
    const g = Number.isInteger(given[i]) ? (given[i] as number) : -1;
    const right = g === item.answer && g >= 0 && g < item.options.length;
    if (right) correct += 1;
    return { q: item.q, options: item.options, given: g, answer: item.answer, right };
  });

  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= quiz.pass_score;

  await env.DB.prepare(
    `INSERT INTO quiz_results (id, user_id, content_id, quiz_id, score, passed, correct, total, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  )
    .bind(
      uuid(crypto),
      user.id,
      contentId,
      quiz.id,
      score,
      passed ? 1 : 0,
      correct,
      questions.length,
      nowIso(),
    )
    .run();

  // قبولی در آزمون = تکمیل آن آیتم.
  if (passed) {
    await env.DB.prepare(
      `INSERT INTO progress (user_id, content_id, status, percent, updated_at)
       VALUES (?1, ?2, 'completed', 100, ?3)
       ON CONFLICT(user_id, content_id) DO UPDATE SET status = 'completed', percent = 100, updated_at = ?3`,
    )
      .bind(user.id, contentId, nowIso())
      .run();
  }

  return {
    ok: true,
    score,
    passed,
    correct,
    total: questions.length,
    passScore: quiz.pass_score,
    review,
  };
}
