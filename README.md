# Sehari — Bahasa Indonesia translator + spaced-repetition learning tool

A dual-purpose tool for a team working across English and Bahasa Indonesia:

1. **Compose** — instant translation for real messaging.
2. **Review** — a spaced-repetition deck built automatically from the messages you actually send.

Communication is the job; learning is the byproduct. **One corpus feeds both modes** — words you
use a lot in real messages surface *less* in Review (the world is your flashcard; Review fills the gaps).

It is **bidirectional and multi-user**: each person has a native + target language, so an
English speaker learns Bahasa while an Indonesian teammate learns English — from the same app.

### Feature set

- **Bidirectional (P1)** — per-user `native_lang` / `target_lang`; items are extracted in the target
  language and glossed in the native one; grammar notes, productive-review direction, and TTS voice
  all follow the user's languages.
- **Name + PIN auth (P2)** — custom auth in the Worker (no email needed) with PBKDF2-hashed PINs,
  signed HttpOnly session cookies, login lockout, and owner-only provisioning. Replaces Cloudflare
  Access.
- **Per-user spend counter (P3)** — every model call logs real token counts + computed cost; see
  today / this-month in Settings.
- **Daily consistency engine (P4)** — honest active-time heartbeat, reps, and a low-floor streak
  ("beat yesterday" without an escalating daily goal).
- **Hands-free audio drill (P5)** — eyes-up: cue (native) → pause → answer (target) → tap to grade.
- **Daily snippet (P6)** — one short, level-appropriate dose of comprehensible input per day.

## Architecture

```
React + Vite (Cloudflare Pages)
        │  talks ONLY to our Worker (never sees the Anthropic key)
        ▼
Cloudflare Worker (Hono)  ──►  Anthropic API   (key = Worker secret)
        │                       haiku = translate, sonnet = grade
        ▼
Cloudflare D1 (SQLite)         scheduling = ts-fsrs (no hand-rolled SR math)
```

- `worker/` — the Hono Worker, D1 migrations, FSRS scheduler, model contract.
- `web/` — the React + Vite frontend, built pixel-faithfully from the Claude Design
  handoff (warm-paper theme, Newsreader serif for Bahasa / Hanken Grotesk sans for
  English, light + dark, three tabs: Compose · Review · Words).

### The model contract

`POST /translate` calls the model with a per-user system prompt (built for the user's native/target
languages in `worker/src/lib/prompts.ts`) and demands a single JSON object: `detected_lang`,
`natural`, `gloss[]`, `back_translation`, `grammar_note`, and `items[]` (each with
lemma/surface/type/**gloss_l1**/root/affixes). Output is parsed defensively — code fences stripped,
shape validated, **one retry** on bad JSON (`worker/src/lib/anthropic.ts`).

### Endpoints

All data routes require a valid session cookie (P2); `/auth/*`, `/admin/*`, and `/health` are public.

| Method | Path               | Purpose                                                        |
| ------ | ------------------ | ------------------------------------------------------------- |
| POST   | `/auth/login`      | Name + PIN → sets HttpOnly session cookie                     |
| POST   | `/auth/logout`     | Clears the session cookie                                     |
| POST   | `/admin/users`     | Owner-only (Bearer `ADMIN_TOKEN`) — provision a user          |
| GET    | `/me`              | Current user's profile (native/target langs)                  |
| POST   | `/translate`       | Translate + harvest the message into the corpus               |
| GET    | `/review/queue`    | Due items (FSRS), most-used first, varied card types          |
| POST   | `/review/grade`    | Apply again/hard/good/easy via ts-fsrs                        |
| POST   | `/review/produce`  | Grade a free-production attempt with the model, then schedule |
| GET    | `/words`           | Full corpus + source sentences (words/phrases/mastered)       |
| GET    | `/stats`           | Due count, retention, "about to forget"                       |
| GET    | `/usage`           | This user's spend today / this month                          |
| POST   | `/activity/ping`   | Active-time heartbeat (paused when hidden/idle)               |
| GET    | `/activity`        | Today vs yesterday, streak, personal best                    |
| GET    | `/daily-snippet`   | One cached daily comprehensible-input snippet                 |
| GET    | `/health`          | Liveness                                                      |

---

## Local development

Prereqs: Node 18+.

```bash
npm install
```

**1. Apply migrations to your local D1:**

```bash
npm run migrate:local           # wrangler d1 migrations apply sehari-db --local
```

**2. Provide local secrets** (gitignored, never committed):

```bash
cp worker/.dev.vars.example worker/.dev.vars
# edit worker/.dev.vars: paste your ANTHROPIC_API_KEY, and keep
#   SESSION_SECRET / ADMIN_TOKEN (any dev strings) and ALLOW_DEV_AUTH="true"
```

`ALLOW_DEV_AUTH="true"` lets local dev skip the login screen (it stamps the seeded `dev@local`
user). It is `"false"` in `wrangler.toml`, so production always requires real login.

**3. Run both halves (two terminals):**

```bash
npm run dev:worker              # wrangler dev on http://127.0.0.1:8787
npm run dev:web                 # vite on http://localhost:5173 (proxies /api -> :8787)
```

Open http://localhost:5173. The frontend reaches the Worker through the Vite `/api` proxy, so there
is no CORS setup and no Worker URL to configure locally.

---

## Deployment — the EXACT manual steps you must do yourself

These need **your** Cloudflare account details. I have left placeholders where your IDs go; I won't
guess them. Run these yourself (or tell me the values and I'll wire them in).

### A. Create the D1 database

```bash
cd worker
npx wrangler login                       # opens a browser; authorize your account
npx wrangler d1 create sehari-db
```

This prints a `database_id`. **Paste it into `worker/wrangler.toml`** replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`.

### B. Run migrations on the remote DB

```bash
npm run migrate:remote                   # wrangler d1 migrations apply sehari-db --remote
```

### C. Set the Worker secrets (NEVER commit these)

```bash
npx wrangler secret put ANTHROPIC_API_KEY    # the model key
npx wrangler secret put SESSION_SECRET       # long random string; signs session cookies
npx wrangler secret put ADMIN_TOKEN          # long random string; guards user provisioning
# optional (only if you enable Turnstile on login):
# npx wrangler secret put TURNSTILE_SECRET
```

> `ANTHROPIC_API_KEY` lives ONLY in this secret — never in the repo, `wrangler.toml`, or the browser.
> If it ever appears client-side, that's a bug — stop.

### D. (Optional) Override model ids / allowed origins

Edit `[vars]` in `worker/wrangler.toml`. Defaults: `MODEL_TRANSLATE=claude-haiku-4-5-20251001`,
`MODEL_GRADE=claude-sonnet-4-6`. Set `ALLOWED_ORIGINS` to your Pages URL before going live (see F).

### E. Deploy the Worker

```bash
cd worker
npx wrangler deploy
```

Note the deployed URL, e.g. `https://sehari-worker.<your-subdomain>.workers.dev`.

### F. Connect the GitHub repo to Cloudflare Pages (the frontend)

In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**:

1. Pick this GitHub repo and branch.
2. **Build settings:**
   - Framework preset: **Vite**
   - Root directory: `web`
   - Build command: `npm install && npm run build`
   - Build output directory: `dist`
3. **Environment variable** (Pages → Settings → Environment variables):
   - `VITE_API_BASE` = your deployed Worker URL from step E.
4. Deploy. Note your Pages URL, e.g. `https://sehari.pages.dev`.
5. Back in `worker/wrangler.toml`, set `ALLOWED_ORIGINS` to that Pages URL and
   `npx wrangler deploy` again (locks CORS down to your site).

### G. Auth: name + PIN (replaces Cloudflare Access)

The app now has its own login, so friends without email can sign in and each user gets their own
deck. **If you previously put Cloudflare Access in front, remove that Access policy** so this login
takes over.

**Cookie / same-site note (important):** the session cookie is set by the Worker. For the browser to
send it back from the Pages app, the Worker and frontend should share a site:

- **Recommended:** serve both under one domain (e.g. `app.example.com` for Pages and
  `app.example.com/api/*` routed to the Worker, or a Worker custom domain on the same root). Then keep
  `SESSION_SAMESITE = "Lax"` in `wrangler.toml`.
- **Cross-site** (`*.pages.dev` + `*.workers.dev`): set `SESSION_SAMESITE = "None"`. Some browsers
  block third-party cookies, so the same-site setup above is strongly preferred.

**Provision users** (owner + friends) with the admin endpoint (uses `ADMIN_TOKEN` from step C):

```bash
curl -X POST https://<your-worker-url>/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"display_name":"you","pin":"<6+ digits>","native_lang":"en","target_lang":"id"}'

curl -X POST https://<your-worker-url>/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"display_name":"budi","pin":"<6+ digits>","native_lang":"id","target_lang":"en"}'
```

Users then sign in at the app with their name + PIN. Login locks a name for 15 minutes after 5 failed
attempts.

### H. (Optional) Cloudflare Turnstile on login

Leave off unless you want bot protection on the login form. To enable: create a Turnstile widget,
set `VITE_TURNSTILE_SITEKEY` in Pages env (step F) and `wrangler secret put TURNSTILE_SECRET`. The
Worker enforces it only when `TURNSTILE_SECRET` is set; the widget appears only when the site key is
set.

---

## Notes & decisions

- **Schema** lives in `worker/migrations/` — `0001_init` (corpus, used verbatim from the design with
  denormalized `due`/`state` + an `exposure` mode), `0002` users + `gloss_l1`, `0003` login lockout,
  `0004` usage, `0005` daily activity, `0006` daily snippet. Every query is user-scoped.
- **Exposure nudge**: each real-world use harvested from Compose is modeled as a successful FSRS
  retrieval, pushing the due date outward — entirely via `ts-fsrs`, no hand-rolled math.
- **Auto-graduation**: items with high FSRS stability that keep appearing in real messages retire
  from the Review queue.
- **Audio** is isolated behind `web/src/lib/audio.ts` (Web Speech API, per-call language — never
  hardcoded — with iOS Safari handling and chained utterances for the hands-free drill) so a cloud
  TTS can swap in later.
- **UI** follows the Claude Design handoff: language is coded by typeface everywhere (Bahasa = serif,
  English = sans), the message→memory loop is made visible ("N added to your deck", source lines,
  the Review badge), and memory strength shows as quiet 5-segment bars. Per your direction, the
  Review screen keeps the design's visual language while adding card-type variety (productive recall,
  cloze, listening, free-production) on top of the prototype's single recall card.
- **Strength meter (1–5)** and **due/next-review labels** are derived from the FSRS card stability —
  no separate "strength" math.
- There is no separate Stats tab (the design has three tabs); the `GET /stats` endpoint still exists
  and powers the due counts / "about to forget" data if you want a dashboard later.
