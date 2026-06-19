-- Migration 0002: P1 bidirectional support.
-- Adds the shared users table (created ONCE here with every column it needs,
-- including pin_hash used later by P2 auth) and generalizes items so glosses are
-- in the learner's NATIVE language (gloss_l1) rather than always English.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- users: one row per person. user_id everywhere == users.id.
--   native_lang  – the language the user already knows (glosses are written in it)
--   target_lang  – the language the user is learning (items are extracted in it)
--   pin_hash     – PBKDF2 hash set by P2 auth; NULL until provisioned
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,                 -- uuid (P2) or identity string (dev/Access)
  display_name TEXT NOT NULL UNIQUE,
  pin_hash     TEXT,                             -- PBKDF2; NULL = not yet provisioned
  native_lang  TEXT NOT NULL DEFAULT 'en',
  target_lang  TEXT NOT NULL DEFAULT 'id',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Local-dev / pre-auth identity so `wrangler dev` keeps working end-to-end.
-- Owner default: native English, target Bahasa Indonesia (unchanged behavior).
INSERT OR IGNORE INTO users (id, display_name, native_lang, target_lang)
  VALUES ('dev@local', 'dev', 'en', 'id');

-- ---------------------------------------------------------------------------
-- items.gloss_en -> gloss_l1  (gloss in the learner's native language).
-- RENAME COLUMN preserves all existing data; no index references this column.
-- ---------------------------------------------------------------------------
ALTER TABLE items RENAME COLUMN gloss_en TO gloss_l1;
