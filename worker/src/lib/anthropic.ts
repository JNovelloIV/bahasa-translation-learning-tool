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
  // Called once on success with the summed token usage across attempts.
  onUsage?: (u: TokenUsage) => Promise<void> | void;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

/** Raw single call to the Anthropic Messages API. Returns text + token usage. */
async function rawCall(env: Env, opts: CallOptions): Promise<{ text: string; usage: TokenUsage }> {
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
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();

  if (!text) throw new Error('Anthropic API returned empty content');
  return {
    text,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  };
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
  const total: TokenUsage = { input_tokens: 0, output_tokens: 0 };

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
      total.input_tokens += raw.usage.input_tokens;
      total.output_tokens += raw.usage.output_tokens;
      const jsonText = stripToJson(raw.text);
      const parsed = JSON.parse(jsonText);
      const result = validate(parsed);
      if (opts.onUsage) await opts.onUsage(total);
      return result;
    } catch (err) {
      lastErr = err;
      // tokens from a successful-but-invalid response are already in `total`; retry
    }
  }

  // Even on total failure, attribute the tokens we burned (best-effort).
  if (opts.onUsage && (total.input_tokens || total.output_tokens)) {
    try {
      await opts.onUsage(total);
    } catch {
      /* ignore logging errors */
    }
  }

  throw new Error(
    `Model JSON parse/validation failed after retry: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}
