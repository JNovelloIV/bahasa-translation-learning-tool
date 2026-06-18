// API client. Talks ONLY to our Worker — it NEVER holds the Anthropic key.
// Base URL: dev uses the Vite /api proxy; prod uses VITE_API_BASE (Worker URL).

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export type LangCode = 'en' | 'id';
export const LANG_NAME: Record<LangCode, string> = { en: 'English', id: 'Bahasa Indonesia' };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include', // send/receive the session cookie
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

// ---- Translate ----

export interface GlossPair {
  src: string;
  tgt: string;
}
export interface ExtractedItem {
  lemma: string;
  surface: string;
  type: 'word' | 'phrase';
  gloss_l1: string;
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

// ---- Review ----

export type CardType = 'recall' | 'cloze' | 'listen' | 'produce';
export interface ReviewCard {
  item_id: string;
  card_type: CardType;
  b: string; // target-language answer
  lemma: string;
  surface: string | null;
  prompt: string; // cue in the learner's native language
  pos: string;
  type: 'word' | 'phrase';
  root: string | null;
  affixes: string[];
  use_count: number;
  strength: number;
  due: string | null;
  state: string;
  cloze: string | null;
  example_b: string | null;
  example_e: string | null;
  source_date: string | null;
}
export interface QueueResponse {
  count: number;
  due_total: number;
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

// ---- Words (the deck) ----

export interface SourceSentence {
  sentence_id: string;
  text: string;
  translation: string;
  lang: 'en' | 'id';
  created_at: string;
}
export interface DeckItem {
  id: string;
  b: string; // Bahasa (lemma)
  e: string; // English (gloss)
  pos: string;
  type: 'word' | 'phrase';
  root: string | null;
  affixes: string[];
  use_count: number;
  strength: number;
  is_due: boolean;
  due: string | null;
  state: string;
  graduated: boolean;
  first_seen: string;
  last_used: string;
  example_b: string | null;
  example_e: string | null;
  source_msg: string | null;
  source_date: string | null;
  sources: SourceSentence[];
}
export interface WordsResponse {
  total: number;
  due_count: number;
  all: DeckItem[];
  words: DeckItem[];
  phrases: DeckItem[];
  mastered: DeckItem[];
}

export interface Profile {
  id: string;
  display_name: string;
  native_lang: LangCode;
  target_lang: LangCode;
}

export const api = {
  me: () => req<Profile>('/me'),
  login: (display_name: string, pin: string, turnstile_token?: string) =>
    req<{ ok: boolean; profile: Profile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ display_name, pin, turnstile_token }),
    }),
  logout: () => req<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
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
};

// ---- small display helpers ----

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "from your message · Tue" style weekday from an ISO date. */
export function weekday(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getDay()];
}

/** Relative due label like "Due now" / "in 3 days" / "in 8 hours". */
export function nextLabel(due: string | null, isDue: boolean): string {
  if (isDue) return 'Due now';
  if (!due) return '';
  const ms = new Date(due).getTime() - Date.now();
  if (ms <= 0) return 'Due now';
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  if (days < 14) return `in ${days} day${days === 1 ? '' : 's'}`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} week${weeks === 1 ? '' : 's'}`;
}
