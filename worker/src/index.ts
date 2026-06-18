import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

import translate from './routes/translate';
import review from './routes/review';
import words from './routes/words';
import stats from './routes/stats';

const app = new Hono<{ Bindings: Env }>();

// CORS — restrict to ALLOWED_ORIGINS (your Pages URL) in production.
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = c.req.header('Origin') ?? '';
  const allowOrigin =
    allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0] ?? '';

  return cors({
    origin: allowOrigin,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })(c, next);
});

app.get('/health', (c) => c.json({ ok: true, service: 'sehari-worker' }));

app.route('/translate', translate);
app.route('/review', review);
app.route('/words', words);
app.route('/stats', stats);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error('unhandled error:', err);
  return c.json({ error: 'Internal error' }, 500);
});

export default app;
