import { Hono } from 'hono';
import type { Env, ItemRow } from '../types';
import { getUserId } from '../lib/auth';

const app = new Hono<{ Bindings: Env }>();

interface SourceJoin {
  item_id: string;
  sentence_id: string;
  text: string;
  translation: string;
  lang: 'en' | 'id';
  created_at: string;
}

// GET /words — the full corpus, sorted by use_count, with source sentences.
// Returns words and phrases separated plus a mastered section; the client can
// further group by morphological family (shared root).
app.get('/', async (c) => {
  const userId = getUserId(c);

  const itemsRes = await c.env.DB.prepare(
    `SELECT * FROM items WHERE user_id = ? ORDER BY use_count DESC, lemma ASC`,
  )
    .bind(userId)
    .all<ItemRow>();
  const items = itemsRes.results ?? [];

  // Pull all sources in one pass and bucket by item_id.
  const srcRes = await c.env.DB.prepare(
    `SELECT isrc.item_id, s.id AS sentence_id, s.text, s.translation, s.lang, s.created_at
       FROM item_sources isrc
       JOIN sentences s ON s.id = isrc.sentence_id
       JOIN items i ON i.id = isrc.item_id
      WHERE i.user_id = ?
      ORDER BY s.created_at DESC`,
  )
    .bind(userId)
    .all<SourceJoin>();

  const sourcesByItem = new Map<string, Array<Omit<SourceJoin, 'item_id'>>>();
  for (const r of srcRes.results ?? []) {
    const list = sourcesByItem.get(r.item_id) ?? [];
    list.push({
      sentence_id: r.sentence_id,
      text: r.text,
      translation: r.translation,
      lang: r.lang,
      created_at: r.created_at,
    });
    sourcesByItem.set(r.item_id, list);
  }

  const shape = (it: ItemRow) => ({
    id: it.id,
    lemma: it.lemma,
    surface: it.surface,
    type: it.type,
    gloss_en: it.gloss_en,
    root: it.root,
    affixes: it.affixes_json ? safeArr(it.affixes_json) : [],
    use_count: it.use_count,
    first_seen: it.first_seen,
    last_used: it.last_used,
    due: it.due,
    state: it.state,
    graduated: it.graduated === 1,
    sources: sourcesByItem.get(it.id) ?? [],
  });

  const shaped = items.map(shape);
  const mastered = shaped.filter((i) => i.graduated);
  const active = shaped.filter((i) => !i.graduated);

  return c.json({
    total: shaped.length,
    words: active.filter((i) => i.type === 'word'),
    phrases: active.filter((i) => i.type === 'phrase'),
    mastered,
  });
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
