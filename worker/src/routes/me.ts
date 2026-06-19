import { Hono } from 'hono';
import type { Env } from '../types';
import { resolveUser } from '../lib/auth';

const app = new Hono<{ Bindings: Env }>();

// GET /me — the current user's profile (drives language coding + TTS on the client).
app.get('/', async (c) => {
  const user = await resolveUser(c);
  return c.json({
    id: user.id,
    display_name: user.display_name,
    native_lang: user.native_lang,
    target_lang: user.target_lang,
  });
});

export default app;
