// Identity. In production, Cloudflare Access sits in front of the Worker and
// injects the authenticated user's email. We stamp that as user_id so the data
// model is multi-user-ready from day one. Locally (no Access), fall back to
// DEV_USER_ID so `wrangler dev` works end-to-end.
//
// NOTE: For real multi-user security you would verify the Cf-Access-Jwt-Assertion
// signature against your Access team's public keys. For MVP behind Access we trust
// the injected header (Access strips client-supplied copies).

import type { Context } from 'hono';
import type { Env } from '../types';

export function getUserId(c: Context<{ Bindings: Env }>): string {
  const email = c.req.header('Cf-Access-Authenticated-User-Email');
  if (email && email.trim()) return email.trim().toLowerCase();
  return c.env.DEV_USER_ID || 'dev@local';
}
