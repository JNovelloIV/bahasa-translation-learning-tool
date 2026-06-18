// Per-user spend tracking (P3). Computes cost from a small, configurable rate
// table and writes one usage row per Anthropic call.

import type { Env } from '../types';
import type { TokenUsage } from './anthropic';

export interface Rate {
  in: number; // USD per 1M input tokens
  out: number; // USD per 1M output tokens
}

// Defaults (USD per 1M tokens). Haiku 4.5 = $1 / $5 (given). Sonnet/Opus are
// sensible defaults; override all via env.MODEL_RATES_JSON.
const DEFAULT_RATES: Record<string, Rate> = {
  haiku: { in: 1, out: 5 },
  sonnet: { in: 3, out: 15 },
  opus: { in: 15, out: 75 },
};

function rateFor(env: Env, model: string): Rate {
  let table = DEFAULT_RATES;
  if (env.MODEL_RATES_JSON) {
    try {
      table = { ...DEFAULT_RATES, ...(JSON.parse(env.MODEL_RATES_JSON) as Record<string, Rate>) };
    } catch {
      /* fall back to defaults */
    }
  }
  const m = model.toLowerCase();
  for (const key of Object.keys(table)) {
    if (m.includes(key)) return table[key];
  }
  return table.haiku ?? { in: 1, out: 5 };
}

export function computeCost(env: Env, model: string, usage: TokenUsage): number {
  const r = rateFor(env, model);
  return (usage.input_tokens / 1_000_000) * r.in + (usage.output_tokens / 1_000_000) * r.out;
}

/** Best-effort: never let usage logging break the user-facing request. */
export async function logUsage(
  env: Env,
  userId: string,
  endpoint: string,
  model: string,
  usage: TokenUsage,
): Promise<void> {
  try {
    const cost = computeCost(env, model, usage);
    await env.DB.prepare(
      `INSERT INTO usage (id, user_id, endpoint, model, input_tokens, output_tokens, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), userId, endpoint, model, usage.input_tokens, usage.output_tokens, cost)
      .run();
  } catch (err) {
    console.error('usage log error:', err);
  }
}
