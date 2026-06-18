// API client. Talks ONLY to our Worker — it NEVER holds the Anthropic key.
// Base URL: dev uses the Vite /api proxy; prod uses VITE_API_BASE (Worker URL).

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include', // forward Cloudflare Access cookies
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ---- Types mirroring the Worker contract ----

export interface GlossPair {
  src: string;
  tgt: string;
}
export interface ExtractedItem {
  lemma: string;
  surface: string;
  type: 'word' | 'phrase';
  gloss_en: string;
  root: string | null;
  affixes: string[];
}
export interface TranslateResponse {
  detected_lang: 'en' | 'id';
  natural: string;
  gloss: GlossPair[];
  back_translation: string;
  grammar_note: string;
  items: ExtractedItem[];
  sentence_id: string;
  harvested: number;
}

export type CardType = 'recall' | 'cloze' | 'listen' | 'produce';
export interface ReviewCard {
  item_id: string;
  card_type: CardType;
  lemma: string;
  surface: string | null;
  gloss_en: string;
  type: 'word' | 'phrase';
  root: string | null;
  affixes: string[];
  use_count: number;
  due: string | null;
  state: string;
  cloze: string | null;
  example: string | null;
}
export interface QueueResponse {
  count: number;
  cards: ReviewCard[];
}

export interface ProduceResponse {
  correct: boolean;
  corrected: string;
  feedback: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  due: string;
  state: string;
}

export interface SourceSentence {
  sentence_id: string;
  text: string;
  translation: string;
  lang: 'en' | 'id';
  created_at: string;
}
export interface WordItem {
  id: string;
  lemma: string;
  surface: string | null;
  type: 'word' | 'phrase';
  gloss_en: string;
  root: string | null;
  affixes: string[];
  use_count: number;
  first_seen: string;
  last_used: string;
  due: string | null;
  state: string;
  graduated: boolean;
  sources: SourceSentence[];
}
export interface WordsResponse {
  total: number;
  words: WordItem[];
  phrases: WordItem[];
  mastered: WordItem[];
}

export interface StatsResponse {
  total: number;
  mastered: number;
  due_count: number;
  reviews_graded: number;
  retention: number | null;
  about_to_forget_count: number;
  about_to_forget: Array<{
    id: string;
    lemma: string;
    gloss_en: string;
    use_count: number;
    retrievability: number;
    due: string | null;
  }>;
}

export const api = {
  translate: (text: string) =>
    req<TranslateResponse>('/translate', { method: 'POST', body: JSON.stringify({ text }) }),
  queue: () => req<QueueResponse>('/review/queue'),
  grade: (item_id: string, rating: string, mode: string) =>
    req<{ ok: boolean; due: string; state: string }>('/review/grade', {
      method: 'POST',
      body: JSON.stringify({ item_id, rating, mode }),
    }),
  produce: (item_id: string, attempt: string, target_meaning: string) =>
    req<ProduceResponse>('/review/produce', {
      method: 'POST',
      body: JSON.stringify({ item_id, attempt, target_meaning }),
    }),
  words: () => req<WordsResponse>('/words'),
  stats: () => req<StatsResponse>('/stats'),
};
