import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'joker_session';

const SESSION_TTL_DAYS = 30;

export function createSessionToken() {
  return randomBytes(32).toString('hex');
}

export function getSessionExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
}

export function getSessionCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.JOKER_SECURE_COOKIES === 'true',
    path: '/',
    expires: expiresAt
  };
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    isAdmin: session.user.isAdmin
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('UNAUTHORIZED');
  }

  return user;
}

export async function requireAdminUser() {
  const user = await requireCurrentUser();

  if (!user.isAdmin) {
    throw new Error('FORBIDDEN');
  }

  return user;
}
