import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { verifyPassword } from '../../../../lib/password';
import {
  SESSION_COOKIE,
  createSessionToken,
  getSessionCookieOptions,
  getSessionExpiresAt
} from '../../../../lib/auth';

export async function POST(request) {
  try {
    const payload = await request.json();
    const username = String(payload?.username || '').trim();
    const password = String(payload?.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Укажи пользователя и пароль.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Неверный пользователь или пароль.' }, { status: 401 });
    }

    const token = createSessionToken();
    const expiresAt = getSessionExpiresAt();

    await prisma.session.create({
      data: {
        token,
        expiresAt,
        userId: user.id
      }
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
      }
    });
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions(expiresAt));

    return response;
  } catch (error) {
    console.error('Failed to login', error);
    return NextResponse.json({ error: 'Не удалось войти.' }, { status: 500 });
  }
}
