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

// GET /admin/setup — a tiny self-contained form to provision users without the
// command line. The form is public HTML, but creating a user still requires the
// ADMIN_TOKEN (entered in the form), so this is safe to leave deployed.
app.get('/setup', (c) => {
  return c.html(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sehari · Create user</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4efe3;color:#241e16;margin:0;padding:32px 18px;}
  .card{max-width:420px;margin:0 auto;background:#fffdf7;border:1px solid #e6dfce;border-radius:18px;padding:22px;}
  h1{font-size:22px;margin:0 0 4px;} p.sub{color:#8b8474;font-size:13px;margin:0 0 18px;}
  label{display:block;font-size:13px;font-weight:600;margin:14px 0 5px;}
  input,select{width:100%;box-sizing:border-box;padding:11px 12px;font-size:16px;border:1px solid #e6dfce;border-radius:11px;background:#ece5d6;color:#241e16;}
  button{width:100%;margin-top:20px;padding:13px;font-size:15px;font-weight:600;color:#fff;background:#bd5a2e;border:none;border-radius:13px;cursor:pointer;}
  #out{margin-top:16px;font-size:14px;white-space:pre-wrap;}
  .ok{color:#5f7a52;} .err{color:#bd5a2e;}
</style></head>
<body><div class="card">
  <h1>Create a Sehari user</h1>
  <p class="sub">Owner-only. You'll need your Admin token.</p>
  <label>Name (used to sign in)</label>
  <input id="name" autocomplete="off" placeholder="e.g. Joe">
  <label>PIN (6+ digits)</label>
  <input id="pin" inputmode="numeric" autocomplete="off" placeholder="••••••">
  <label>Native language (the one they already know)</label>
  <select id="native"><option value="en">English</option><option value="id">Bahasa Indonesia</option></select>
  <label>Target language (the one they're learning)</label>
  <select id="target"><option value="id">Bahasa Indonesia</option><option value="en">English</option></select>
  <label>Admin token</label>
  <input id="token" type="password" autocomplete="off" placeholder="paste your ADMIN_TOKEN">
  <button id="go">Create user</button>
  <div id="out"></div>
</div>
<script>
  const out = document.getElementById('out');
  document.getElementById('go').onclick = async () => {
    out.textContent = 'Creating…'; out.className = '';
    try {
      const r = await fetch('/admin/users', {
        method:'POST',
        headers:{'content-type':'application/json','authorization':'Bearer '+document.getElementById('token').value.trim()},
        body: JSON.stringify({
          display_name: document.getElementById('name').value.trim(),
          pin: document.getElementById('pin').value.trim(),
          native_lang: document.getElementById('native').value,
          target_lang: document.getElementById('target').value,
        })
      });
      const d = await r.json();
      if (r.ok) { out.textContent = '✓ Created "'+d.display_name+'". You can now sign in at the app.'; out.className='ok'; }
      else { out.textContent = '✗ '+(d.error||('Error '+r.status)); out.className='err'; }
    } catch(e){ out.textContent = '✗ '+e; out.className='err'; }
  };
</script>
</body></html>`);
});

export default app;
