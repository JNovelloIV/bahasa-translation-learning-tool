import { Hono } from 'hono';
import type { Env } from '../types';
import { resolveUser } from '../lib/auth';
import { callModelJSON } from '../lib/anthropic';
import { validateTranslation } from '../lib/validate';
import { buildTranslationSystemPrompt } from '../lib/prompts';
import { harvestTranslation } from '../lib/harvest';
import { logUsage } from '../lib/usage';

const app = new Hono<{ Bindings: Env }>();

// POST /translate  { text: string }
// Translates, then harvests the result into the corpus.
app.post('/', async (c) => {
  let body: { text?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return c.json({ error: 'Missing "text"' }, 400);
  if (text.length > 2000) return c.json({ error: 'Text too long (max 2000 chars)' }, 400);

  const user = await resolveUser(c);

  let result;
  try {
    result = await callModelJSON(
      c.env,
      {
        model: c.env.MODEL_TRANSLATE,
        system: buildTranslationSystemPrompt(user.native_lang, user.target_lang),
        messages: [{ role: 'user', content: text }],
        maxTokens: 1500,
        temperature: 0,
        onUsage: (u) => logUsage(c.env, user.id, 'translate', c.env.MODEL_TRANSLATE, u),
      },
      validateTranslation,
    );
  } catch (err) {
    console.error('translate model error:', err);
    return c.json({ error: 'Translation failed. Please try again.' }, 502);
  }

  // Harvest is best-effort: never fail the translation if storage hiccups.
  let harvest = { sentenceId: '', itemsUpserted: 0 };
  try {
    harvest = await harvestTranslation({ env: c.env, userId: user.id, inputText: text, result });
  } catch (err) {
    console.error('harvest error:', err);
  }

  return c.json({ ...result, sentence_id: harvest.sentenceId, harvested: harvest.itemsUpserted });
});

export default app;
