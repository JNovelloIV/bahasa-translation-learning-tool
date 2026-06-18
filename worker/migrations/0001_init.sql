-- Migration 0001_init.sql
-- Sehari: dual-purpose Bahasa Indonesia translator + spaced-repetition learning app.
-- Cloudflare D1 (SQLite). Apply with:  wrangler d1 migrations apply <DB_NAME>

-- D1 honors foreign keys when declared; safe to keep on.
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- sentences: every real message the user translated. One row per Compose action.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sentences (
  id           TEXT PRIMARY KEY,                            -- Worker-supplied UUID (crypto.randomUUID())
  user_id      TEXT NOT NULL,                               -- from Cloudflare Access identity
  lang         TEXT NOT NULL CHECK (lang IN ('en','id')),   -- detected source language
  text         TEXT NOT NULL,                               -- original input
  translation  TEXT NOT NULL,                               -- natural / copy-ready output
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sentences_user_created
  ON sentences (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- items: the personalized corpus. Every Bahasa word/phrase worth learning.
-- Items are ALWAYS Bahasa (the language being acquired), regardless of input direction.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,                            -- Worker-supplied UUID
  user_id      TEXT NOT NULL,
  lemma        TEXT NOT NULL,                               -- canonical form to learn (e.g. "belajar")
  surface      TEXT,                                        -- form as it appeared (e.g. "belajarnya")
  type         TEXT NOT NULL CHECK (type IN ('word','phrase')),
  gloss_en     TEXT NOT NULL,                               -- English meaning
  root         TEXT,                                        -- morphological root (e.g. "ajar"); NULL if none
  affixes_json TEXT,                                        -- JSON array of affixes (e.g. ["ber-"])
  use_count    INTEGER NOT NULL DEFAULT 1,                  -- times it appears in real messages
  first_seen   TEXT NOT NULL DEFAULT (datetime('now')),
  last_used    TEXT NOT NULL DEFAULT (datetime('now')),
  -- FSRS scheduling: full ts-fsrs Card kept in fsrs_json; due/state denormalized for querying.
  fsrs_json    TEXT,                                        -- serialized ts-fsrs Card
  due          TEXT,                                        -- next review timestamp (ISO); NULL = brand new
  state        TEXT NOT NULL DEFAULT 'new'
                 CHECK (state IN ('new','learning','review','relearning')),
  graduated    INTEGER NOT NULL DEFAULT 0,                  -- 0/1; mastered + still used -> retired from queue
  UNIQUE (user_id, lemma)
);
-- Review-queue lookup: WHERE user_id=? AND graduated=0 AND due<=now
CREATE INDEX IF NOT EXISTS idx_items_due
  ON items (user_id, graduated, due);
-- "Most used" sort for the Words screen and tie-breaking in the queue.
CREATE INDEX IF NOT EXISTS idx_items_use_count
  ON items (user_id, use_count DESC);
-- Group by morphological family (shared root).
CREATE INDEX IF NOT EXISTS idx_items_root
  ON items (user_id, root);

-- ---------------------------------------------------------------------------
-- item_sources: which real sentences each item came from (for cloze + context).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_sources (
  item_id     TEXT NOT NULL REFERENCES items(id)     ON DELETE CASCADE,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, sentence_id)
);
CREATE INDEX IF NOT EXISTS idx_item_sources_sentence
  ON item_sources (sentence_id);

-- ---------------------------------------------------------------------------
-- review_log: every retrieval AND every real-world exposure.
-- rating is NULL when mode='exposure' (a word used in a real sent message).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  rating      TEXT CHECK (rating IN ('again','hard','good','easy')),   -- NULL for exposures
  mode        TEXT NOT NULL CHECK (mode IN ('recall','cloze','listen','produce','exposure')),
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_log_item
  ON review_log (item_id, reviewed_at DESC);
