import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdminUser } from '../../../../lib/auth';
import { buildGameProtocol } from '../../../../lib/game-storage';

const PLAYER_NAME_FIELDS = ['player1Name', 'player2Name', 'player3Name', 'player4Name'];

function cleanUsername(value) {
  return String(value || '').trim();
}

function getPlayerKeyByNameField(field) {
  return field.replace('Name', '');
}

function parseRoundsFromScores(scoresJson) {
  if (!scoresJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(scoresJson);

    if (parsed?.rounds && typeof parsed.rounds === 'object') {
      return parsed.rounds;
    }

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildUpdatedGameData(game, oldUsername, newUsername) {
  const data = {};
  const players = {};
  let hasPlayerRename = false;

  PLAYER_NAME_FIELDS.forEach((field) => {
    const playerKey = getPlayerKeyByNameField(field);
    const nextName = game[field] === oldUsername ? newUsername : game[field];

    players[playerKey] = nextName;

    if (nextName !== game[field]) {
      data[field] = nextName;
      hasPlayerRename = true;
    }
  });

  if (hasPlayerRename && game.scoresJson) {
    const rounds = parseRoundsFromScores(game.scoresJson);
    data.scoresJson = JSON.stringify({
      rounds,
      protocol: buildGameProtocol(players, rounds)
    });
  }

  return hasPlayerRename ? data : null;
}

export async function PATCH(request, { params }) {
  try {
    await requireAdminUser();

    const payload = await request.json();
    const username = cleanUsername(payload?.username);

    if (!username) {
      return NextResponse.json({ error: 'Укажи новое имя игрока.' }, { status: 400 });
    }

    if (username.length < 2) {
      return NextResponse.json({ error: 'Имя игрока должно быть длиннее одного символа.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: params.id
      },
      select: {
        id: true,
        username: true
      }
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'Игрок не найден.' }, { status: 404 });
    }

    if (existingUser.username === username) {
      return NextResponse.json({
        user: existingUser,
        updatedGames: 0
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: params.id
        },
        data: {
          username
        },
        select: {
          id: true,
          username: true
        }
      });

      const games = await tx.game.findMany({
        where: {
          OR: PLAYER_NAME_FIELDS.map((field) => ({
            [field]: existingUser.username
          }))
        },
        select: {
          id: true,
          player1Name: true,
          player2Name: true,
          player3Name: true,
          player4Name: true,
          scoresJson: true
        }
      });

      const updates = games
        .map((game) => ({
          id: game.id,
          data: buildUpdatedGameData(game, existingUser.username, username)
        }))
        .filter((update) => update.data);

      for (const update of updates) {
        await tx.game.update({
          where: {
            id: update.id
          },
          data: update.data
        });
      }

      return {
        user: updatedUser,
        updatedGames: updates.length
      };
    });

    return NextResponse.json(result);
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

    console.error('Failed to rename user', error);
    return NextResponse.json({ error: 'Не удалось переименовать игрока.' }, { status: 500 });
  }
}
