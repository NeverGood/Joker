import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdminUser } from '../../../../lib/auth';

function cleanTotal(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanDurationSeconds(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function cleanTitle(value) {
  return String(value ?? '').trim();
}

export async function PATCH(request, { params }) {
  try {
    await requireAdminUser();

    const payload = await request.json();
    const totals = payload?.totals || {};
    const title = cleanTitle(payload?.title);

    if (Object.prototype.hasOwnProperty.call(payload, 'title') && !title) {
      return NextResponse.json({ error: 'Укажи название партии.' }, { status: 400 });
    }

    const updateData = {
      player1Total: cleanTotal(totals.player1),
      player2Total: cleanTotal(totals.player2),
      player3Total: cleanTotal(totals.player3),
      player4Total: cleanTotal(totals.player4)
    };

    if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
      updateData.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'durationSeconds')) {
      updateData.durationSeconds = cleanDurationSeconds(payload.durationSeconds);
    }

    const updated = await prisma.game.update({
      where: {
        id: params.id
      },
      data: updateData
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      durationSeconds: updated.durationSeconds,
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
