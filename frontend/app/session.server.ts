import { createCookieSessionStorage } from '@remix-run/node';

const sessionSecret = process.env.SESSION_SECRET || 'dev-session-secret-change-me';

export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: '__kenshin_session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 14,
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === 'production',
  },
});

export const SESSION_TOKEN = 'accessToken';
export const SESSION_USER_ID = 'userId';
export const SESSION_ROLE = 'role';
export const SESSION_NAME = 'displayName';

export async function readAuthToken(request: Request): Promise<string | null> {
  const session = await getSession(request.headers.get('Cookie'));
  return session.get(SESSION_TOKEN) ?? null;
}
