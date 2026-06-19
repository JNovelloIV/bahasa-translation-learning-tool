import { Hono } from 'hono';
import type { Env } from '../types';
import { getUserId } from '../lib/auth';
import { addActiveSeconds, getActivity } from '../lib/activity';

const app = new Hono<{ Bindings: Env }>();

// POST /activity/ping { seconds } — heartbeat of ACTIVE time (paused client-side
// when the tab is hidden or input has been idle).
app.post('/ping', async (c) => {
  let body: { seconds?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const seconds = typeof body.seconds === 'number' ? body.seconds : 0;
  await addActiveSeconds(c.env, getUserId(c), seconds);
  return c.json({ ok: true });
});

// GET /activity — today vs yesterday, streak, personal best.
app.get('/', async (c) => {
  return c.json(await getActivity(c.env, getUserId(c)));
});

export default app;
