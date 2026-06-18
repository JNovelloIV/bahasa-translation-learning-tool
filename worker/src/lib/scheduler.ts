// Spaced-repetition scheduling — a thin wrapper over ts-fsrs.
// We do NOT hand-roll any SR math; every interval comes from the library.
//
// Design notes:
// - A "review" is an explicit retrieval in the Review screen (again/hard/good/easy).
// - An "exposure" is a real-world use harvested from Compose. We model it as a
//   successful retrieval (Rating.Good) so the library pushes the due date OUTWARD —
//   words the user actually uses a lot naturally surface LESS in Review.
// - We persist the full ts-fsrs Card as JSON and denormalize due/state for querying.

import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type Card,
  type Grade,
} from 'ts-fsrs';

const f = fsrs(generatorParameters({ enable_fuzz: true }));

export type UiRating = 'again' | 'hard' | 'good' | 'easy';

const RATING_MAP: Record<UiRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const STATE_MAP: Record<State, 'new' | 'learning' | 'review' | 'relearning'> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

export interface ScheduleSnapshot {
  fsrs_json: string;
  due: string; // ISO
  state: 'new' | 'learning' | 'review' | 'relearning';
  stability: number;
}

/** Revive a stored Card (dates come back as strings from JSON). */
function loadCard(fsrs_json: string | null, now: Date): Card {
  if (!fsrs_json) return createEmptyCard(now);
  try {
    const raw = JSON.parse(fsrs_json) as Record<string, unknown>;
    const card = createEmptyCard(now);
    return {
      ...card,
      ...raw,
      due: raw.due ? new Date(raw.due as string) : card.due,
      last_review: raw.last_review ? new Date(raw.last_review as string) : undefined,
    } as Card;
  } catch {
    return createEmptyCard(now);
  }
}

function snapshot(card: Card): ScheduleSnapshot {
  return {
    fsrs_json: JSON.stringify(card),
    due: new Date(card.due).toISOString(),
    state: STATE_MAP[card.state],
    stability: card.stability ?? 0,
  };
}

/** Brand-new card with no history. */
export function newSchedule(now = new Date()): ScheduleSnapshot {
  return snapshot(createEmptyCard(now));
}

/** Apply an explicit review grade from the Review screen. */
export function applyReview(
  fsrs_json: string | null,
  rating: UiRating,
  now = new Date(),
): ScheduleSnapshot {
  const card = loadCard(fsrs_json, now);
  const { card: next } = f.next(card, now, RATING_MAP[rating]);
  return snapshot(next);
}

/**
 * Apply a light real-world exposure (from Compose harvest). Modeled as a
 * successful retrieval so the due date moves outward via the library.
 */
export function applyExposure(
  fsrs_json: string | null,
  now = new Date(),
): ScheduleSnapshot {
  const card = loadCard(fsrs_json, now);
  const { card: next } = f.next(card, now, Rating.Good);
  return snapshot(next);
}

/** Current retrievability (0..1) of a stored card, for "about to forget" stats. */
export function retrievability(fsrs_json: string | null, now = new Date()): number {
  if (!fsrs_json) return 0;
  const card = loadCard(fsrs_json, now);
  return f.get_retrievability(card, now, false) as number;
}
