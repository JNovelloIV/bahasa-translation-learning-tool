// Harvest: turn a translated message into corpus rows.
// Stores the sentence, upserts every extracted Bahasa item (dedup on lemma),
// bumps use_count / last_used, registers a "real-world exposure" that nudges the
// FSRS schedule outward, links each item to its source sentence, and logs the
// exposure in review_log (rating NULL, mode 'exposure').

import type { Env, ExtractedItem, TranslationResult } from '../types';
import { applyExposure, newSchedule } from './scheduler';

const GRADUATE_STABILITY_DAYS = 60; // high stability => mastered
const GRADUATE_MIN_USE = 5; // and still showing up in real messages

interface HarvestArgs {
  env: Env;
  userId: string;
  inputText: string;
  result: TranslationResult;
}

export async function harvestTranslation({
  env,
  userId,
  inputText,
  result,
}: HarvestArgs): Promise<{ sentenceId: string; itemsUpserted: number }> {
  const db = env.DB;
  const now = new Date();
  const nowIso = now.toISOString();

  // 1) Store the sentence.
  const sentenceId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO sentences (id, user_id, lang, text, translation, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(sentenceId, userId, result.detected_lang, inputText, result.natural, nowIso)
    .run();

  // 2) Upsert each item. Dedup on lemma (per the UNIQUE(user_id, lemma) index).
  let upserted = 0;
  const seenLemmas = new Set<string>();

  for (const item of result.items) {
    const lemma = item.lemma.trim();
    if (!lemma || seenLemmas.has(lemma)) continue; // de-dupe within one message
    seenLemmas.add(lemma);

    const itemId = await upsertItem(env, userId, item, sentenceId, now);
    if (itemId) upserted++;
  }

  return { sentenceId, itemsUpserted: upserted };
}

async function upsertItem(
  env: Env,
  userId: string,
  item: ExtractedItem,
  sentenceId: string,
  now: Date,
): Promise<string | null> {
  const db = env.DB;
  const nowIso = now.toISOString();
  const affixesJson = JSON.stringify(item.affixes ?? []);

  const existing = await db
    .prepare(
      `SELECT id, fsrs_json, use_count, graduated FROM items
       WHERE user_id = ? AND lemma = ?`,
    )
    .bind(userId, item.lemma)
    .first<{ id: string; fsrs_json: string | null; use_count: number; graduated: number }>();

  let itemId: string;

  if (existing) {
    // Existing item: a real-world exposure nudges its schedule outward.
    itemId = existing.id;
    const sched = applyExposure(existing.fsrs_json, now);
    const newUseCount = existing.use_count + 1;

    // Auto-graduate: high stability AND still appearing in real messages.
    const graduate =
      existing.graduated === 1 ||
      (sched.stability >= GRADUATE_STABILITY_DAYS && newUseCount >= GRADUATE_MIN_USE)
        ? 1
        : 0;

    await db
      .prepare(
        `UPDATE items
           SET surface = ?, gloss_l1 = COALESCE(NULLIF(?, ''), gloss_l1),
               root = ?, affixes_json = ?,
               use_count = ?, last_used = ?,
               fsrs_json = ?, due = ?, state = ?, graduated = ?
         WHERE id = ?`,
      )
      .bind(
        item.surface,
        item.gloss_l1,
        item.root,
        affixesJson,
        newUseCount,
        nowIso,
        sched.fsrs_json,
        sched.due,
        sched.state,
        graduate,
        itemId,
      )
      .run();
  } else {
    // New item: seed an empty card, then apply this first exposure.
    itemId = crypto.randomUUID();
    const seeded = newSchedule(now);
    const sched = applyExposure(seeded.fsrs_json, now);

    await db
      .prepare(
        `INSERT INTO items
           (id, user_id, lemma, surface, type, gloss_l1, root, affixes_json,
            use_count, first_seen, last_used, fsrs_json, due, state, graduated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 0)`,
      )
      .bind(
        itemId,
        userId,
        item.lemma,
        item.surface,
        item.type,
        item.gloss_l1,
        item.root,
        affixesJson,
        nowIso,
        nowIso,
        sched.fsrs_json,
        sched.due,
        sched.state,
      )
      .run();
  }

  // Link item -> source sentence (ignore if already linked).
  await db
    .prepare(
      `INSERT OR IGNORE INTO item_sources (item_id, sentence_id) VALUES (?, ?)`,
    )
    .bind(itemId, sentenceId)
    .run();

  // Log the exposure (rating NULL, mode 'exposure').
  await db
    .prepare(
      `INSERT INTO review_log (item_id, rating, mode, reviewed_at)
       VALUES (?, NULL, 'exposure', ?)`,
    )
    .bind(itemId, nowIso)
    .run();

  return itemId;
}
