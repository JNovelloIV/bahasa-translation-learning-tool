// Defensive validators for model output. Reject malformed shapes so callModelJSON
// can trigger its single retry, and coerce loosely-typed fields into our contract.

import type { TranslationResult, ExtractedItem, ProduceResult } from '../types';

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export function validateTranslation(parsed: unknown): TranslationResult {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('translation: not an object');
  }
  const o = parsed as Record<string, unknown>;

  const detected = o.detected_lang;
  if (detected !== 'en' && detected !== 'id') {
    throw new Error('translation: bad detected_lang');
  }
  if (typeof o.natural !== 'string' || o.natural.trim() === '') {
    throw new Error('translation: missing natural');
  }

  const gloss = Array.isArray(o.gloss)
    ? o.gloss
        .filter((g): g is Record<string, unknown> => typeof g === 'object' && g !== null)
        .map((g) => ({ src: asString(g.src), tgt: asString(g.tgt) }))
    : [];

  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items: ExtractedItem[] = [];
  for (const it of itemsRaw) {
    if (typeof it !== 'object' || it === null) continue;
    const r = it as Record<string, unknown>;
    const lemma = asString(r.lemma).trim();
    if (!lemma) continue; // lemma is required to be useful
    const type = r.type === 'phrase' ? 'phrase' : 'word';
    items.push({
      lemma,
      surface: asString(r.surface, lemma),
      type,
      // Prefer gloss_l1 (native-language gloss); accept gloss_en for robustness.
      gloss_l1: asString(r.gloss_l1) || asString(r.gloss_en),
      root: typeof r.root === 'string' && r.root.trim() !== '' ? r.root : null,
      affixes: asStringArray(r.affixes),
    });
  }

  return {
    detected_lang: detected,
    natural: o.natural,
    gloss,
    back_translation: asString(o.back_translation),
    grammar_note: asString(o.grammar_note),
    items,
  };
}

export function validateProduce(parsed: unknown): ProduceResult {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('produce: not an object');
  }
  const o = parsed as Record<string, unknown>;
  const rating = o.rating;
  if (rating !== 'again' && rating !== 'hard' && rating !== 'good' && rating !== 'easy') {
    throw new Error('produce: bad rating');
  }
  return {
    correct: o.correct === true,
    corrected: asString(o.corrected),
    feedback: asString(o.feedback),
    rating,
  };
}
