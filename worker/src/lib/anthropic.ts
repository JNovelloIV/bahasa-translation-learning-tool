// Thin Anthropic API client for the Worker.
// The API key lives ONLY here, read from the Worker secret env. It is never
// returned to the client. All callers go through callModelJSON, which strips
// code fences, validates the parsed shape, and retries once on bad JSON.

import type { Env } from '../types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CallOptions {
  model: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
}

/** Raw single call to the Anthropic Messages API. Returns the text content. */
async function rawCall(env: Env, opts: CallOptions): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': env.ANTHROPIC_VERSION || '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();

  if (!text) throw new Error('Anthropic API returned empty content');
  return text;
}

/** Remove ```json … ``` fences and any stray prose around a JSON object. */
export function stripToJson(raw: string): string {
  let s = raw.trim();
  // Strip leading/trailing code fences.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  // If there is surrounding prose, grab the outermost { … }.
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s.trim();
}

/**
 * Call the model and parse strict JSON, validating with `validate`.
 * Retries ONCE with a corrective nudge if parsing or validation fails.
 */
export async function callModelJSON<T>(
  env: Env,
  opts: CallOptions,
  validate: (parsed: unknown) => T,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages =
      attempt === 0
        ? opts.messages
        : [
            ...opts.messages,
            {
              role: 'user' as const,
              content:
                'Your previous response was not valid JSON matching the required shape. Respond again with a SINGLE valid JSON object and nothing else — no code fences, no commentary.',
            },
          ];

    try {
      const raw = await rawCall(env, { ...opts, messages });
      const jsonText = stripToJson(raw);
      const parsed = JSON.parse(jsonText);
      return validate(parsed);
    } catch (err) {
      lastErr = err;
      // fall through to retry
    }
  }

  throw new Error(
    `Model JSON parse/validation failed after retry: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}
