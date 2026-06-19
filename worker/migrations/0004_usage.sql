-- Migration 0004: P3 per-user spend counter.
-- One row per Anthropic call with the real token counts and computed cost.

CREATE TABLE IF NOT EXISTS usage (
  id            TEXT PRIMARY KEY,                 -- uuid
  user_id       TEXT NOT NULL,
  endpoint      TEXT NOT NULL,                    -- 'translate' | 'produce' | 'daily-snippet'
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_user_created
  ON usage (user_id, created_at DESC);
