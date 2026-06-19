// Daily consistency engine (P4). Active time accrues only from the heartbeat;
// reps mirror graded reviews. Streak has a LOW floor so a short honest day counts.

import type { Env } from '../types';

export const FLOOR_SECONDS = 120; // 2 active minutes keeps the streak…
export const REPS_FLOOR = 3; // …or 3 reviews
export const MAX_PING_SECONDS = 30; // clamp a single heartbeat

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function addActiveSeconds(env: Env, userId: string, seconds: number): Promise<void> {
  const s = Math.max(0, Math.min(MAX_PING_SECONDS, Math.floor(seconds)));
  if (!s) return;
  const day = utcDay();
  await env.DB.prepare(
    `INSERT INTO daily_activity (user_id, day, active_seconds, reps)
     VALUES (?, ?, ?, 0)
     ON CONFLICT(user_id, day) DO UPDATE SET active_seconds = active_seconds + ?`,
  )
    .bind(userId, day, s, s)
    .run();
}

export async function bumpReps(env: Env, userId: string): Promise<void> {
  const day = utcDay();
  await env.DB.prepare(
    `INSERT INTO daily_activity (user_id, day, active_seconds, reps)
     VALUES (?, ?, 0, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET reps = reps + 1`,
  )
    .bind(userId, day)
    .run();
}

interface DayRow {
  day: string;
  active_seconds: number;
  reps: number;
}

const met = (r: DayRow | undefined): boolean =>
  !!r && (r.active_seconds >= FLOOR_SECONDS || r.reps >= REPS_FLOOR);

function shiftDay(day: string, deltaDays: number): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export interface ActivitySummary {
  today: { active_seconds: number; reps: number };
  yesterday: { active_seconds: number; reps: number };
  streak: number;
  best: number;
  floor_seconds: number;
  reps_floor: number;
  met_today: boolean;
}

export async function getActivity(env: Env, userId: string): Promise<ActivitySummary> {
  const res = await env.DB.prepare(
    `SELECT day, active_seconds, reps FROM daily_activity WHERE user_id = ? ORDER BY day ASC`,
  )
    .bind(userId)
    .all<DayRow>();
  const rows = res.results ?? [];
  const byDay = new Map<string, DayRow>();
  for (const r of rows) byDay.set(r.day, r);

  const today = utcDay();
  const yesterday = shiftDay(today, -1);
  const t = byDay.get(today);
  const y = byDay.get(yesterday);

  // Current streak: walk back from today (or yesterday if today not yet met) over
  // consecutive met days.
  let streak = 0;
  let cursor = met(t) ? today : yesterday;
  while (met(byDay.get(cursor))) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }

  // Best streak over all history: longest run of consecutive met days.
  const best = longestRun(rows.filter(met).map((r) => r.day));

  return {
    today: { active_seconds: t?.active_seconds ?? 0, reps: t?.reps ?? 0 },
    yesterday: { active_seconds: y?.active_seconds ?? 0, reps: y?.reps ?? 0 },
    streak,
    best: Math.max(best, streak),
    floor_seconds: FLOOR_SECONDS,
    reps_floor: REPS_FLOOR,
    met_today: met(t),
  };
}

function longestRun(days: string[]): number {
  if (days.length === 0) return 0;
  const sorted = [...days].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === shiftDay(sorted[i - 1], 1) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}
