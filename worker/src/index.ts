import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './types';
import { requireAuth } from './lib/session';

import auth from './routes/auth';
import admin from './routes/admin';
import me from './routes/me';
import translate from './routes/translate';
import review from './routes/review';
import words from './routes/words';
import stats from './routes/stats';
import usage from './routes/usage';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Routes that require a valid session (everything that touches user data).
const PROTECTED = ['/me', '/translate', '/review', '/words', '/stats', '/usage', '/activity', '/daily-snippet'];

// CORS — credentialed (cookies), so we reflect a specific allowed origin, never "*".
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const reqOrigin = c.req.header('Origin') ?? '';
  const allowOrigin = allowed.includes('*')
    ? reqOrigin || '*'
    : allowed.includes(reqOrigin)
      ? reqOrigin
      : allowed[0] ?? '';

  return cors({
    origin: allowOrigin,
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next);
});

// Gate the protected prefixes; auth/admin/health stay public (admin self-guards).
app.use('*', async (c, next) => {
  const path = c.req.path;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + '/'));
  return isProtected ? requireAuth(c, next) : next();
});

app.get('/health', (c) => c.json({ ok: true, service: 'sehari-worker' }));

app.route('/auth', auth);
app.route('/admin', admin);
app.route('/me', me);
app.route('/translate', translate);
app.route('/review', review);
app.route('/words', words);
app.route('/stats', stats);
app.route('/usage', usage);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error('unhandled error:', err);
  return c.json({ error: 'Internal error' }, 500);
});

export default app;
