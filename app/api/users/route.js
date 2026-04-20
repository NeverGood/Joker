import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser } from '../../../lib/auth';

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
