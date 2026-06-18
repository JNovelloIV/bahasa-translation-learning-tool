import { Hono, type Context } from 'hono';
import type { Env, Variables, LangCode } from '../types';
import { hashPin } from '../lib/crypto';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const MIN_PIN_LEN = 6;
const LANGS: LangCode[] = ['en', 'id'];

// Owner-only guard: requires the ADMIN_TOKEN secret via Authorization: Bearer.
function adminAuthorized(c: Context<{ Bindings: Env; Variables: Variables }>): boolean {
  const expected = c.env.ADMIN_TOKEN;
  if (!expected) return false; // not configured -> closed by default
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token.length > 0 && token === expected;
}

// POST /admin/users  { display_name, pin, native_lang, target_lang }
// Provisions a user (owner or friend). The app hashes the PIN; plaintext is never stored.
app.post('/users', async (c) => {
  if (!adminAuthorized(c)) return c.json({ error: 'Forbidden' }, 403);

  let body: { display_name?: unknown; pin?: unknown; native_lang?: unknown; target_lang?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  const nativeLang = body.native_lang as LangCode;
  const targetLang = body.target_lang as LangCode;

  if (!displayName) return c.json({ error: 'display_name required' }, 400);
  if (pin.length < MIN_PIN_LEN) return c.json({ error: `PIN must be at least ${MIN_PIN_LEN} digits` }, 400);
  if (!LANGS.includes(nativeLang) || !LANGS.includes(targetLang) || nativeLang === targetLang) {
    return c.json({ error: 'native_lang and target_lang must be distinct (en|id)' }, 400);
  }

  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE display_name = ?`)
    .bind(displayName)
    .first<{ id: string }>();
  if (existing) return c.json({ error: 'That name is taken' }, 409);

  const id = crypto.randomUUID();
  const pinHash = await hashPin(pin);
  await c.env.DB.prepare(
    `INSERT INTO users (id, display_name, pin_hash, native_lang, target_lang)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, displayName, pinHash, nativeLang, targetLang)
    .run();

  return c.json({ ok: true, id, display_name: displayName });
});

export default app;
