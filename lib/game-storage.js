import { DEFAULT_PLAYERS, PLAYER_KEYS } from './game-config';

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function cleanNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function serializeGame(game) {
  return {
    id: game.id,
    title: game.title,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    players: {
      player1: game.player1Name,
      player2: game.player2Name,
      player3: game.player3Name,
      player4: game.player4Name
    },
    totals: {
      player1: game.player1Total,
      player2: game.player2Total,
      player3: game.player3Total,
      player4: game.player4Total
    },
    rounds: game.scoresJson ? JSON.parse(game.scoresJson) : {}
  };
}

export function buildGameCreateInput(payload) {
  const players = payload?.players || {};
  const totals = payload?.totals || {};
  const createdAt = cleanDate(payload?.createdAt);

  return {
    title: cleanText(payload?.title, `Партия ${new Date().toLocaleString('ru-RU')}`),
    player1Name: cleanText(players.player1, DEFAULT_PLAYERS.player1),
    player2Name: cleanText(players.player2, DEFAULT_PLAYERS.player2),
    player3Name: cleanText(players.player3, DEFAULT_PLAYERS.player3),
    player4Name: cleanText(players.player4, DEFAULT_PLAYERS.player4),
    player1Total: cleanNumber(totals.player1),
    player2Total: cleanNumber(totals.player2),
    player3Total: cleanNumber(totals.player3),
    player4Total: cleanNumber(totals.player4),
    scoresJson: JSON.stringify(payload?.rounds || {}),
    ...(createdAt ? { createdAt } : {})
  };
}

export function buildAggregateTotals(games) {
  return PLAYER_KEYS.reduce((acc, playerKey) => {
    acc[playerKey] = games.reduce((sum, game) => sum + cleanNumber(game.totals?.[playerKey]), 0);
    return acc;
  }, {});
}
