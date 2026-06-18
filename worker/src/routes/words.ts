import { Hono } from 'hono';
import type { Env, ItemRow } from '../types';
import { resolveUser } from '../lib/auth';
import { strength } from '../lib/scheduler';
import { sideInLang } from '../lib/derive';

const app = new Hono<{ Bindings: Env }>();

interface SourceJoin {
  item_id: string;
  sentence_id: string;
  text: string;
  translation: string;
  lang: 'en' | 'id';
  created_at: string;
}

// GET /words — the full corpus with everything the Words screen + detail sheet need:
// strength meter, due flag, a usage example, and the source message it was saved from.
app.get('/', async (c) => {
  const user = await resolveUser(c);
  const userId = user.id;
  const nowIso = new Date().toISOString();

  const itemsRes = await c.env.DB.prepare(
    `SELECT * FROM items WHERE user_id = ? ORDER BY use_count DESC, lemma ASC`,
  )
    .bind(userId)
    .all<ItemRow>();
  const items = itemsRes.results ?? [];

  // All sources in one pass, newest first, bucketed by item.
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

  const sourcesByItem = new Map<string, SourceJoin[]>();
  for (const r of srcRes.results ?? []) {
    const list = sourcesByItem.get(r.item_id) ?? [];
    list.push(r);
    sourcesByItem.set(r.item_id, list);
  }

  const shape = (it: ItemRow) => {
    const srcs = sourcesByItem.get(it.id) ?? [];
    const recent = srcs[0]; // newest
    const earliest = srcs[srcs.length - 1]; // oldest = "first saved from"
    const isDue = it.graduated === 0 && (it.due === null || it.due <= nowIso);
    return {
      id: it.id,
      b: it.lemma,
      e: it.gloss_l1,
      pos: it.type, // design shows "<gloss> · pos"; we surface word/phrase
      type: it.type,
      root: it.root,
      affixes: it.affixes_json ? safeArr(it.affixes_json) : [],
      use_count: it.use_count,
      strength: strength(it.fsrs_json, it.graduated === 1),
      is_due: isDue,
      due: it.due,
      state: it.state,
      graduated: it.graduated === 1,
      first_seen: it.first_seen,
      last_used: it.last_used,
      example_b: recent ? sideInLang(recent, user.target_lang) : null,
      example_e: recent ? sideInLang(recent, user.native_lang) : null,
      source_msg: earliest ? earliest.text : null,
      source_date: earliest ? earliest.created_at : null,
      sources: srcs.map((s) => ({
        sentence_id: s.sentence_id,
        text: s.text,
        translation: s.translation,
        lang: s.lang,
        created_at: s.created_at,
      })),
    };
  };

  const shaped = items.map(shape);
  const mastered = shaped.filter((i) => i.graduated);
  const active = shaped.filter((i) => !i.graduated);
  const dueCount = active.filter((i) => i.is_due).length;

  return c.json({
    total: shaped.length,
    due_count: dueCount,
    all: shaped, // single deck (design's source of truth)
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
