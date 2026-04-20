import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdminUser } from '../../../../lib/auth';

function cleanTotal(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function PATCH(request, { params }) {
  try {
    await requireAdminUser();

    const payload = await request.json();
    const totals = payload?.totals || {};
    const updated = await prisma.game.update({
      where: {
        id: params.id
      },
      data: {
        player1Total: cleanTotal(totals.player1),
        player2Total: cleanTotal(totals.player2),
        player3Total: cleanTotal(totals.player3),
        player4Total: cleanTotal(totals.player4)
      }
    });

    return NextResponse.json({
      id: updated.id,
      totals: {
        player1: updated.player1Total,
        player2: updated.player2Total,
        player3: updated.player3Total,
        player4: updated.player4Total
      }
    });
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }

    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Недостаточно прав.' }, { status: 403 });
    }

    console.error('Failed to update game', error);
    return NextResponse.json({ error: 'Не удалось обновить партию.' }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await requireAdminUser();

    await prisma.game.delete({
      where: {
        id: params.id
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }

    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Недостаточно прав.' }, { status: 403 });
    }

    console.error('Failed to delete game', error);
    return NextResponse.json({ error: 'Не удалось удалить партию.' }, { status: 500 });
  }
}
