// Session cookie + auth middleware for P2.

import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, Variables } from '../types';
import { signSession, verifySession } from './crypto';

export const COOKIE_NAME = 'sehari_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

export async function issueSession(c: Ctx, userId: string, displayName: string): Promise<void> {
  const token = await signSession({ sub: userId, name: displayName }, c.env.SESSION_SECRET, SESSION_TTL_SECONDS);
  const sameSite = (c.env.SESSION_SAMESITE as 'Lax' | 'None' | 'Strict') || 'Lax';
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true, // browsers allow Secure on http://localhost; required for SameSite=None
    sameSite,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSession(c: Ctx): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}

// Reject requests without a valid session. Local dev may opt into a bypass via
// ALLOW_DEV_AUTH=true (set ONLY in .dev.vars), which stamps the dev identity.
export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);
  if (token && c.env.SESSION_SECRET) {
    const payload = await verifySession(token, c.env.SESSION_SECRET);
    if (payload?.sub) {
      c.set('userId', payload.sub);
      return next();
    }
  }

  if (c.env.ALLOW_DEV_AUTH === 'true' && c.env.DEV_USER_ID) {
    c.set('userId', c.env.DEV_USER_ID);
    return next();
  }

  return c.json({ error: 'Unauthorized' }, 401);
};
