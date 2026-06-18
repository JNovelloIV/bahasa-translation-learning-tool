import { Hono } from 'hono';
import type { Env, ItemRow } from '../types';
import { getUserId } from '../lib/auth';
import { retrievability } from '../lib/scheduler';

const app = new Hono<{ Bindings: Env }>();

const FORGET_THRESHOLD = 0.9; // retrievability below this = "about to forget"

// GET /stats — due count, retention, and items about to forget.
app.get('/', async (c) => {
  const userId = getUserId(c);
  const now = new Date();
  const nowIso = now.toISOString();

  const totalRow = await c.env.DB.prepare(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN graduated = 1 THEN 1 ELSE 0 END) AS mastered,
        SUM(CASE WHEN graduated = 0 AND (due IS NULL OR due <= ?) THEN 1 ELSE 0 END) AS due_count
       FROM items WHERE user_id = ?`,
  )
    .bind(nowIso, userId)
    .first<{ total: number; mastered: number; due_count: number }>();

  // Retention: share of graded reviews (rating not null) that were not "again".
  const retRow = await c.env.DB.prepare(
    `SELECT
        COUNT(*) AS graded,
        SUM(CASE WHEN rating <> 'again' THEN 1 ELSE 0 END) AS recalled
       FROM review_log rl
       JOIN items i ON i.id = rl.item_id
      WHERE i.user_id = ? AND rl.rating IS NOT NULL`,
  )
    .bind(userId)
    .first<{ graded: number; recalled: number }>();

  const graded = retRow?.graded ?? 0;
  const retention = graded > 0 ? (retRow!.recalled ?? 0) / graded : null;

  // "About to forget": active items whose current retrievability has dropped.
  const activeRes = await c.env.DB.prepare(
    `SELECT * FROM items
      WHERE user_id = ? AND graduated = 0 AND fsrs_json IS NOT NULL
      ORDER BY use_count DESC`,
  )
    .bind(userId)
    .all<ItemRow>();

  const aboutToForget = [];
  for (const it of activeRes.results ?? []) {
    const r = retrievability(it.fsrs_json, now);
    if (r < FORGET_THRESHOLD) {
      aboutToForget.push({
        id: it.id,
        lemma: it.lemma,
        gloss_en: it.gloss_en,
        use_count: it.use_count,
        retrievability: Math.round(r * 100) / 100,
        due: it.due,
      });
    }
  }
  aboutToForget.sort((a, b) => a.retrievability - b.retrievability);

  return c.json({
    total: totalRow?.total ?? 0,
    mastered: totalRow?.mastered ?? 0,
    due_count: totalRow?.due_count ?? 0,
    reviews_graded: graded,
    retention, // 0..1 or null if no reviews yet
    about_to_forget_count: aboutToForget.length,
    about_to_forget: aboutToForget.slice(0, 10),
  });
});

export default app;
