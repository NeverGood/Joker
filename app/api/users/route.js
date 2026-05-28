import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser, requireAdminUser } from '../../../lib/auth';
import { hashPassword } from '../../../lib/password';

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: {
      username: 'asc'
    },
    select: {
      id: true,
      username: true
    }
  });

  return NextResponse.json(users);
}

export async function POST(request) {
  try {
    await requireAdminUser();

    const payload = await request.json();
    const username = String(payload?.username || '').trim();
    const password = String(payload?.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Укажи имя игрока и пароль.' }, { status: 400 });
    }

    if (username.length < 2) {
      return NextResponse.json({ error: 'Имя игрока должно быть длиннее одного символа.' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Пароль должен быть не короче 4 символов.' }, { status: 400 });
    }

    const createdUser = await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        isAdmin: false
      },
      select: {
        id: true,
        username: true
      }
    });

    return NextResponse.json(createdUser, { status: 201 });
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }

    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Недостаточно прав.' }, { status: 403 });
    }

    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Игрок с таким именем уже существует.' }, { status: 409 });
    }

    console.error('Failed to create user', error);
    return NextResponse.json({ error: 'Не удалось добавить игрока.' }, { status: 500 });
  }
}
