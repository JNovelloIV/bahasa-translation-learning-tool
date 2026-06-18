// Shared types for the Sehari Worker.

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  MODEL_TRANSLATE: string;
  MODEL_GRADE: string;
  ANTHROPIC_VERSION: string;
  ALLOWED_ORIGINS: string;
  DEV_USER_ID: string;
  // P2 auth
  SESSION_SECRET: string; // Worker secret — signs session JWTs
  ADMIN_TOKEN: string; // Worker secret — guards owner-only provisioning
  ALLOW_DEV_AUTH: string; // "true" only in local dev (.dev.vars); never in prod
  SESSION_SAMESITE: string; // "Lax" (same-site deploy) or "None" (cross-site)
  TURNSTILE_SECRET?: string; // optional; when set, /login requires a Turnstile token
  MODEL_RATES_JSON?: string; // optional override of per-model USD/1M-token rates
}

// Per-request context vars set by middleware.
export interface Variables {
  userId?: string;
}

// ---- The model contract (matches translation-system-prompt.md exactly) ----

export interface GlossPair {
  src: string;
  tgt: string;
}

export type LangCode = 'en' | 'id';

export interface ExtractedItem {
  lemma: string;
  surface: string;
  type: 'word' | 'phrase';
  gloss_l1: string; // gloss in the learner's NATIVE language
  root: string | null;
  affixes: string[];
}

export interface TranslationResult {
  detected_lang: 'en' | 'id';
  natural: string;
  gloss: GlossPair[];
  back_translation: string;
  grammar_note: string;
  items: ExtractedItem[];
}

// ---- Grading contract for free production ----

export interface ProduceResult {
  correct: boolean;
  corrected: string;
  feedback: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
}

// ---- DB row shapes ----

export interface ItemRow {
  id: string;
  user_id: string;
  lemma: string;
  surface: string | null;
  type: 'word' | 'phrase';
  gloss_l1: string;
  root: string | null;
  affixes_json: string | null;
  use_count: number;
  first_seen: string;
  last_used: string;
  fsrs_json: string | null;
  due: string | null;
  state: 'new' | 'learning' | 'review' | 'relearning';
  graduated: number;
}

export interface SentenceRow {
  id: string;
  user_id: string;
  lang: 'en' | 'id';
  text: string;
  translation: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  display_name: string;
  pin_hash: string | null;
  native_lang: LangCode;
  target_lang: LangCode;
  created_at: string;
}
