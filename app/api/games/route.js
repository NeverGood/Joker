import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { buildGameCreateInput, serializeGame } from '../../../lib/game-storage';
import { getInvalidTrickTotalRounds } from '../../../lib/game-config';
import { getCurrentUser, requireAdminUser } from '../../../lib/auth';

export async function GET() {
  const games = await prisma.game.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });

  return NextResponse.json(games.map(serializeGame));
}

export async function POST(request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }

    const payload = await request.json();
    const isManualArchive = Boolean(payload?.manualArchive);

    if (isManualArchive && !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Недостаточно прав.' }, { status: 403 });
    }

    const invalidTrickRounds = isManualArchive ? [] : getInvalidTrickTotalRounds(payload?.rounds);

    if (invalidTrickRounds.length > 0) {
      return NextResponse.json(
        {
          error: 'Сумма взятых карт должна точно совпадать с количеством карт в каждой раздаче.',
          invalidRounds: invalidTrickRounds.map((round) => ({
            id: round.id,
            hand: round.hand,
            cards: round.cards
          }))
        },
        { status: 400 }
      );
    }

    const created = await prisma.game.create({
      data: buildGameCreateInput(payload)
    });

    return NextResponse.json(serializeGame(created), { status: 201 });
  } catch (error) {
    console.error('Failed to create game', error);
    return NextResponse.json({ error: 'Не удалось сохранить партию.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdminUser();

    await prisma.game.deleteMany();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }

    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Недостаточно прав.' }, { status: 403 });
    }

    console.error('Failed to delete games', error);
    return NextResponse.json({ error: 'Не удалось удалить партии.' }, { status: 500 });
  }
}
