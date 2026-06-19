-- Migration 0003: P2 auth — login rate-limiting / lockout.
-- Tracks failed attempts per display_name (works even for unknown names, so we
-- never leak which names exist). Sessions themselves are stateless signed JWTs,
-- so no sessions table is needed.

CREATE TABLE IF NOT EXISTS login_attempts (
  display_name TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,                              -- ISO; NULL = not locked
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
