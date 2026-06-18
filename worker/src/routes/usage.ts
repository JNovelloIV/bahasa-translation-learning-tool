import { Hono } from 'hono';
import type { Env } from '../types';
import { getUserId } from '../lib/auth';

const app = new Hono<{ Bindings: Env }>();

interface Totals {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

const EMPTY: Totals = { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };

// GET /usage — this user's spend today and this month (server-local UTC day/month).
app.get('/', async (c) => {
  const userId = getUserId(c);

  const q = `SELECT COUNT(*) AS calls,
                    COALESCE(SUM(input_tokens),0) AS input_tokens,
                    COALESCE(SUM(output_tokens),0) AS output_tokens,
                    COALESCE(SUM(cost_usd),0) AS cost_usd
               FROM usage WHERE user_id = ? AND `;

  const today = await c.env.DB.prepare(q + `date(created_at) = date('now')`)
    .bind(userId)
    .first<Totals>();
  const month = await c.env.DB.prepare(q + `strftime('%Y-%m', created_at) = strftime('%Y-%m','now')`)
    .bind(userId)
    .first<Totals>();

  const round = (t: Totals | null): Totals =>
    t ? { ...t, cost_usd: Math.round((t.cost_usd ?? 0) * 10000) / 10000 } : { ...EMPTY };

  return c.json({ today: round(today), month: round(month) });
});

export default app;
