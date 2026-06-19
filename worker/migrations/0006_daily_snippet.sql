-- Migration 0006: P6 daily comprehensible-input snippet.
-- Cached once per user per day so it doesn't regenerate on refresh.

CREATE TABLE IF NOT EXISTS daily_snippet (
  user_id     TEXT NOT NULL,
  day         TEXT NOT NULL,                      -- 'YYYY-MM-DD' (UTC)
  target_text TEXT NOT NULL,                      -- the snippet, in the TARGET language
  gloss_l1    TEXT NOT NULL,                      -- gloss in the learner's NATIVE language
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, day)
);
