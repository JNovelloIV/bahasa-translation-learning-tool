-- Migration 0005: P4 daily consistency engine.
-- One row per user per day. active_seconds accrues from the frontend heartbeat
-- (active time only, never idle); reps mirrors graded reviews that day.

CREATE TABLE IF NOT EXISTS daily_activity (
  user_id        TEXT NOT NULL,
  day            TEXT NOT NULL,                   -- 'YYYY-MM-DD' (UTC)
  active_seconds INTEGER NOT NULL DEFAULT 0,
  reps           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
