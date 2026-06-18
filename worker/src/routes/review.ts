import { Hono } from 'hono';
import type { Env, ItemRow } from '../types';
import { getUserId } from '../lib/auth';
import { applyReview, type UiRating } from '../lib/scheduler';
import { callModelJSON } from '../lib/anthropic';
import { validateProduce } from '../lib/validate';
import { buildProduceSystemPrompt, buildProduceUserPrompt } from '../lib/prompts';

const app = new Hono<{ Bindings: Env }>();

const QUEUE_LIMIT = 20;
type CardType = 'recall' | 'cloze' | 'listen' | 'produce';

// Rotation pattern: default to PRODUCTIVE recall, sprinkle the others,
// keep free production occasional.
const PATTERN: CardType[] = [
  'recall',
  'cloze',
  'recall',
  'listen',
  'recall',
  'cloze',
  'produce',
  'recall',
  'listen',
  'recall',
];

interface SourceRow {
  text: string;
  translation: string;
  lang: 'en' | 'id';
}

/** Pick a real source sentence's Bahasa side for cloze/context. */
async function bahasaSource(
  env: Env,
  itemId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT s.text, s.translation, s.lang
       FROM item_sources isrc
       JOIN sentences s ON s.id = isrc.sentence_id
      WHERE isrc.item_id = ?
      ORDER BY s.created_at DESC
      LIMIT 1`,
  )
    .bind(itemId)
    .first<SourceRow>();
  if (!row) return null;
  // Items are always Bahasa: that's `text` when the message was in id, else the translation.
  return row.lang === 'id' ? row.text : row.translation;
}

/** Blank the target out of a sentence (case-insensitive, first occurrence). */
function makeCloze(sentence: string, surface: string, lemma: string): string | null {
  for (const needle of [surface, lemma]) {
    if (!needle) continue;
    const idx = sentence.toLowerCase().indexOf(needle.toLowerCase());
    if (idx !== -1) {
      return sentence.slice(0, idx) + '_____' + sentence.slice(idx + needle.length);
    }
  }
  return null;
}

// GET /review/queue — items past their FSRS due date, most-used first.
app.get('/queue', async (c) => {
  const userId = getUserId(c);
  const nowIso = new Date().toISOString();

  const rows = await c.env.DB.prepare(
    `SELECT * FROM items
      WHERE user_id = ? AND graduated = 0
        AND (due IS NULL OR due <= ?)
      ORDER BY use_count DESC, due ASC
      LIMIT ?`,
  )
    .bind(userId, nowIso, QUEUE_LIMIT)
    .all<ItemRow>();

  const items = rows.results ?? [];
  const cards = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let cardType = PATTERN[i % PATTERN.length];

    let cloze: string | null = null;
    let example: string | null = null;

    if (cardType === 'cloze') {
      const src = await bahasaSource(c.env, it.id);
      cloze = src ? makeCloze(src, it.surface ?? '', it.lemma) : null;
      if (!cloze) cardType = 'recall'; // no usable sentence -> fall back
    } else {
      example = await bahasaSource(c.env, it.id);
    }

    cards.push({
      item_id: it.id,
      card_type: cardType,
      lemma: it.lemma,
      surface: it.surface,
      gloss_en: it.gloss_en,
      type: it.type,
      root: it.root,
      affixes: it.affixes_json ? safeArr(it.affixes_json) : [],
      use_count: it.use_count,
      due: it.due,
      state: it.state,
      cloze,
      example,
    });
  }

  return c.json({ count: cards.length, cards });
});

// POST /review/grade  { item_id, rating, mode }
app.post('/grade', async (c) => {
  let body: { item_id?: unknown; rating?: unknown; mode?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const userId = getUserId(c);
  const itemId = typeof body.item_id === 'string' ? body.item_id : '';
  const rating = body.rating as UiRating;
  const mode = typeof body.mode === 'string' ? body.mode : 'recall';

  if (!itemId) return c.json({ error: 'Missing item_id' }, 400);
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
    return c.json({ error: 'Bad rating' }, 400);
  }
  if (!['recall', 'cloze', 'listen', 'produce'].includes(mode)) {
    return c.json({ error: 'Bad mode' }, 400);
  }

  const item = await c.env.DB.prepare(
    `SELECT id, fsrs_json FROM items WHERE id = ? AND user_id = ?`,
  )
    .bind(itemId, userId)
    .first<{ id: string; fsrs_json: string | null }>();
  if (!item) return c.json({ error: 'Item not found' }, 404);

  const sched = applyReview(item.fsrs_json, rating);

  await c.env.DB.prepare(
    `UPDATE items SET fsrs_json = ?, due = ?, state = ? WHERE id = ?`,
  )
    .bind(sched.fsrs_json, sched.due, sched.state, itemId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO review_log (item_id, rating, mode, reviewed_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(itemId, rating, mode, new Date().toISOString())
    .run();

  return c.json({ ok: true, due: sched.due, state: sched.state });
});

// POST /review/produce  { item_id, attempt, target_meaning }
// Grades a free-production attempt via the model, then schedules via FSRS.
app.post('/produce', async (c) => {
  let body: { item_id?: unknown; attempt?: unknown; target_meaning?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const userId = getUserId(c);
  const itemId = typeof body.item_id === 'string' ? body.item_id : '';
  const attempt = typeof body.attempt === 'string' ? body.attempt.trim() : '';
  const targetMeaning = typeof body.target_meaning === 'string' ? body.target_meaning.trim() : '';

  if (!itemId) return c.json({ error: 'Missing item_id' }, 400);
  if (!attempt) return c.json({ error: 'Missing attempt' }, 400);

  const item = await c.env.DB.prepare(
    `SELECT id, gloss_en, fsrs_json FROM items WHERE id = ? AND user_id = ?`,
  )
    .bind(itemId, userId)
    .first<{ id: string; gloss_en: string; fsrs_json: string | null }>();
  if (!item) return c.json({ error: 'Item not found' }, 404);

  const meaning = targetMeaning || item.gloss_en;

  let graded;
  try {
    graded = await callModelJSON(
      c.env,
      {
        model: c.env.MODEL_GRADE,
        system: buildProduceSystemPrompt(),
        messages: [{ role: 'user', content: buildProduceUserPrompt(meaning, attempt) }],
        maxTokens: 500,
        temperature: 0,
      },
      validateProduce,
    );
  } catch (err) {
    console.error('produce grade error:', err);
    return c.json({ error: 'Grading failed. Please try again.' }, 502);
  }

  const sched = applyReview(item.fsrs_json, graded.rating);

  await c.env.DB.prepare(
    `UPDATE items SET fsrs_json = ?, due = ?, state = ? WHERE id = ?`,
  )
    .bind(sched.fsrs_json, sched.due, sched.state, itemId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO review_log (item_id, rating, mode, reviewed_at) VALUES (?, ?, 'produce', ?)`,
  )
    .bind(itemId, graded.rating, new Date().toISOString())
    .run();

  return c.json({ ...graded, due: sched.due, state: sched.state });
});

function safeArr(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export default app;
