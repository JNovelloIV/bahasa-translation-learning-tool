# Sehari — Bahasa Indonesia translator + spaced-repetition learning tool

A dual-purpose tool for a manager working daily with an Indonesian team:

1. **Compose** — instant English ⇄ Bahasa Indonesia translation for real messaging.
2. **Review** — a spaced-repetition deck built automatically from the messages you actually send.

Communication is the job; learning is the byproduct. **One corpus feeds both modes** — words you
use a lot in real messages surface *less* in Review (the world is your flashcard; Review fills the gaps).

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
- `web/` — the React + Vite frontend (a minimal functional skin; final visual design pending).

### The model contract

`POST /translate` calls the model with the translation rules as the system prompt
(`worker/src/lib/prompts.ts`, mirrored in `translation-system-prompt.md`) and demands a single JSON
object: `detected_lang`, `natural`, `gloss[]`, `back_translation`, `grammar_note`, and `items[]`
(each with lemma/surface/type/gloss_en/root/affixes). Output is parsed defensively — code fences
stripped, shape validated, **one retry** on bad JSON (`worker/src/lib/anthropic.ts`).

### Endpoints

| Method | Path              | Purpose                                                        |
| ------ | ----------------- | ------------------------------------------------------------- |
| POST   | `/translate`      | Translate + harvest the message into the corpus               |
| GET    | `/review/queue`   | Due items (FSRS), most-used first, varied card types          |
| POST   | `/review/grade`   | Apply again/hard/good/easy via ts-fsrs                        |
| POST   | `/review/produce` | Grade a free-production attempt with the model, then schedule |
| GET    | `/words`          | Full corpus + source sentences (words/phrases/mastered)       |
| GET    | `/stats`          | Due count, retention, "about to forget"                       |
| GET    | `/health`         | Liveness                                                      |

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

**2. Provide the Anthropic key for local dev** (gitignored, never committed):

```bash
cp worker/.dev.vars.example worker/.dev.vars
# edit worker/.dev.vars and paste your real key
```

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

### C. Set the Anthropic API key as a Worker secret (NEVER commit it)

```bash
npx wrangler secret put ANTHROPIC_API_KEY
# paste your key when prompted
```

> The key lives ONLY in this secret. It is never in the repo, never in `wrangler.toml`, and never
> sent to the browser. If it ever appears client-side, that's a bug — stop.

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

### G. Put Cloudflare Access in front

So only you (and later your team) can use it, and so each user gets their own deck:

1. Cloudflare dashboard → **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Add **two** applications (or one covering both hostnames): your **Pages URL** and your **Worker URL**.
3. Create an Access **policy** allowing your email (e.g. allow emails ending in your domain, or a
   specific allow-list).
4. Access then injects `Cf-Access-Authenticated-User-Email` into requests; the Worker stamps that as
   `user_id` on every row, so the app is already multi-user-ready.

> Until Access is configured, the Worker falls back to the `DEV_USER_ID` identity from
> `wrangler.toml` — fine for local dev, but **do not** expose the Worker publicly without Access.

---

## Notes & decisions

- **Schema** is `worker/migrations/0001_init.sql`, used verbatim from the design (adds denormalized
  `due`/`state` columns and an `exposure` review mode beyond the brief's sketch).
- **Exposure nudge**: each real-world use harvested from Compose is modeled as a successful FSRS
  retrieval, pushing the due date outward — entirely via `ts-fsrs`, no hand-rolled math.
- **Auto-graduation**: items with high FSRS stability that keep appearing in real messages retire
  from the Review queue.
- **Audio** is isolated behind `web/src/lib/audio.ts` (Web Speech API, `id-ID`, with iOS Safari
  handling) so a cloud TTS can swap in later.
- The current UI is a deliberately plain functional skin. The Claude Design frames (mobile layouts,
  dark-mode spec) did not arrive in the brief; once provided, the UI will be reskinned to match.
