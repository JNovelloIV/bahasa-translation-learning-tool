import { Hono } from 'hono';
import type { Env } from '../types';
import { resolveUser } from '../lib/auth';
import { callModelJSON } from '../lib/anthropic';
import { validateSnippet } from '../lib/validate';
import { buildSnippetSystemPrompt, buildSnippetUserPrompt } from '../lib/prompts';
import { logUsage } from '../lib/usage';

const app = new Hono<{ Bindings: Env }>();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET /daily-snippet — one short, level-appropriate dose of comprehensible input
// in the target language, cached once per day per user.
app.get('/', async (c) => {
  const user = await resolveUser(c);
  const day = utcDay();

  // Serve today's cached snippet if present.
  const cached = await c.env.DB.prepare(
    `SELECT target_text, gloss_l1, created_at FROM daily_snippet WHERE user_id = ? AND day = ?`,
  )
    .bind(user.id, day)
    .first<{ target_text: string; gloss_l1: string; created_at: string }>();
  if (cached) {
    return c.json({ text: cached.target_text, gloss: cached.gloss_l1, day, cached: true });
  }

  // Gather material: mostly known/mastered words + 1–2 due ("new-ish") words.
  const nowIso = new Date().toISOString();
  const knownRes = await c.env.DB.prepare(
    `SELECT lemma FROM items
      WHERE user_id = ? AND (graduated = 1 OR state IN ('review','relearning'))
      ORDER BY use_count DESC LIMIT 6`,
  )
    .bind(user.id)
    .all<{ lemma: string }>();
  let known = (knownRes.results ?? []).map((r) => r.lemma);

  if (known.length < 3) {
    const anyRes = await c.env.DB.prepare(
      `SELECT lemma FROM items WHERE user_id = ? ORDER BY use_count DESC LIMIT 6`,
    )
      .bind(user.id)
      .all<{ lemma: string }>();
    known = (anyRes.results ?? []).map((r) => r.lemma);
  }

  if (known.length < 3) {
    // Not enough corpus yet to make a level-appropriate snippet.
    return c.json({ empty: true, day });
  }

  const dueRes = await c.env.DB.prepare(
    `SELECT lemma FROM items
      WHERE user_id = ? AND graduated = 0 AND (due IS NULL OR due <= ?)
      ORDER BY use_count DESC LIMIT 2`,
  )
    .bind(user.id, nowIso)
    .all<{ lemma: string }>();
  const fresh = (dueRes.results ?? []).map((r) => r.lemma).filter((l) => !known.includes(l));

  let snippet;
  try {
    snippet = await callModelJSON(
      c.env,
      {
        model: c.env.MODEL_TRANSLATE,
        system: buildSnippetSystemPrompt(user.native_lang, user.target_lang),
        messages: [{ role: 'user', content: buildSnippetUserPrompt(known, fresh) }],
        maxTokens: 600,
        temperature: 0.6,
        onUsage: (u) => logUsage(c.env, user.id, 'daily-snippet', c.env.MODEL_TRANSLATE, u),
      },
      validateSnippet,
    );
  } catch (err) {
    console.error('daily-snippet error:', err);
    return c.json({ error: 'Could not generate today’s snippet.' }, 502);
  }

  // Cache (ignore race: first writer wins).
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO daily_snippet (user_id, day, target_text, gloss_l1) VALUES (?, ?, ?, ?)`,
  )
    .bind(user.id, day, snippet.text, snippet.gloss)
    .run();

  return c.json({ text: snippet.text, gloss: snippet.gloss, day, cached: false });
});

export default app;
