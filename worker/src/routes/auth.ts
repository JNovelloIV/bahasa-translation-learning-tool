import { Hono } from 'hono';
import type { Env, Variables, UserRow } from '../types';
import { verifyPin } from '../lib/crypto';
import { issueSession, clearSession } from '../lib/session';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const MIN_PIN_LEN = 6;

// Verify a Cloudflare Turnstile token (only enforced when TURNSTILE_SECRET is set).
async function turnstileOk(env: Env, token: string | undefined, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true; // not configured -> skip
  if (!token) return false;
  try {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// POST /auth/login { display_name, pin, turnstile_token? }
app.post('/login', async (c) => {
  let body: { display_name?: unknown; pin?: unknown; turnstile_token?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  const token = typeof body.turnstile_token === 'string' ? body.turnstile_token : undefined;

  if (!displayName || !pin) return c.json({ error: 'Name and PIN are required' }, 400);
  if (pin.length < MIN_PIN_LEN) return c.json({ error: `PIN must be at least ${MIN_PIN_LEN} digits` }, 400);

  // Lockout check (per name).
  const nowIso = new Date().toISOString();
  const att = await c.env.DB.prepare(
    `SELECT fails, locked_until FROM login_attempts WHERE display_name = ?`,
  )
    .bind(displayName)
    .first<{ fails: number; locked_until: string | null }>();
  if (att?.locked_until && att.locked_until > nowIso) {
    return c.json({ error: 'Too many attempts. Try again later.' }, 429);
  }

  const ip = c.req.header('CF-Connecting-IP') ?? '';
  if (!(await turnstileOk(c.env, token, ip))) {
    return c.json({ error: 'Verification failed. Please retry.' }, 403);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE display_name = ?`,
  )
    .bind(displayName)
    .first<UserRow>();

  const ok = user ? await verifyPin(pin, user.pin_hash) : false;

  if (!ok) {
    await recordFailure(c.env, displayName);
    return c.json({ error: 'Invalid name or PIN' }, 401);
  }

  // Success — reset attempts, issue session.
  await c.env.DB.prepare(`DELETE FROM login_attempts WHERE display_name = ?`).bind(displayName).run();
  await issueSession(c, user!.id, user!.display_name);

  return c.json({
    ok: true,
    profile: {
      id: user!.id,
      display_name: user!.display_name,
      native_lang: user!.native_lang,
      target_lang: user!.target_lang,
    },
  });
});

// POST /auth/logout
app.post('/logout', (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

async function recordFailure(env: Env, displayName: string): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT fails FROM login_attempts WHERE display_name = ?`,
  )
    .bind(displayName)
    .first<{ fails: number }>();
  const fails = (row?.fails ?? 0) + 1;
  const lockedUntil =
    fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  await env.DB.prepare(
    `INSERT INTO login_attempts (display_name, fails, locked_until, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(display_name) DO UPDATE SET fails = ?, locked_until = ?, updated_at = datetime('now')`,
  )
    .bind(displayName, fails, lockedUntil, fails, lockedUntil)
    .run();
}

export default app;
