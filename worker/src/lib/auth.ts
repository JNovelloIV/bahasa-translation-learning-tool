// Identity & per-user profile resolution.
//
// P1: identity still comes from the dev/Access fallback (getUserId). P2 replaces
// this with a verified session cookie that stamps c.var.userId; getUserId already
// prefers that, so the P2 swap is seamless.
//
// resolveUser() returns the user's row (id + native/target languages), creating a
// sensible default row on first sight so nothing 500s before provisioning exists.

import type { Context } from 'hono';
import type { Env, LangCode } from '../types';

export interface ResolvedUser {
  id: string;
  display_name: string;
  native_lang: LangCode;
  target_lang: LangCode;
}

export function getUserId(c: Context<{ Bindings: Env }>): string {
  // P2 session middleware sets this once the cookie is verified.
  const fromSession = (c.var as Record<string, unknown>).userId;
  if (typeof fromSession === 'string' && fromSession) return fromSession;

  const email = c.req.header('Cf-Access-Authenticated-User-Email');
  if (email && email.trim()) return email.trim().toLowerCase();
  return c.env.DEV_USER_ID || 'dev@local';
}

export async function resolveUser(c: Context<{ Bindings: Env }>): Promise<ResolvedUser> {
  const id = getUserId(c);

  const row = await c.env.DB.prepare(
    `SELECT id, display_name, native_lang, target_lang FROM users WHERE id = ?`,
  )
    .bind(id)
    .first<ResolvedUser>();
  if (row) return row;

  // First sight of this identity (dev / Access): provision an owner-style default.
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO users (id, display_name, native_lang, target_lang)
     VALUES (?, ?, 'en', 'id')`,
  )
    .bind(id, id)
    .run();

  const created = await c.env.DB.prepare(
    `SELECT id, display_name, native_lang, target_lang FROM users WHERE id = ?`,
  )
    .bind(id)
    .first<ResolvedUser>();

  return created ?? { id, display_name: id, native_lang: 'en', target_lang: 'id' };
}
