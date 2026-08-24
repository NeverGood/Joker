import {
  calculateBlockTotals,
  calculatePlayerRoundScore,
  DEFAULT_PLAYERS,
  PLAYER_KEYS,
  ROUND_PRESET,
  normalizeInteger
} from './game-config';

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

function cleanDuration(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizePlayerCounters(source = {}, { booleanAsOne = false } = {}) {
  return PLAYER_KEYS.reduce((acc, playerKey) => {
    const value = source?.[playerKey];

    if (booleanAsOne && typeof value === 'boolean') {
      acc[playerKey] = value ? 1 : 0;
      return acc;
    }

    const parsed = Number.parseInt(String(value ?? 0), 10);
    acc[playerKey] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    return acc;
  }, {});
}

function getPlayerSnapshot(source) {
  return {
    player1: cleanText(source?.player1, DEFAULT_PLAYERS.player1),
    player2: cleanText(source?.player2, DEFAULT_PLAYERS.player2),
    player3: cleanText(source?.player3, DEFAULT_PLAYERS.player3),
    player4: cleanText(source?.player4, DEFAULT_PLAYERS.player4)
  };
}

function getProtocolScoreType({ bid, tricks, isPremium = false, isCut = false }) {
  if (bid === null || tricks === null) {
    return 'soft';
  }

  if (isCut) {
    return 'cut';
  }

  if (isPremium) {
    return 'premium';
  }

  if (tricks === bid) {
    return 'positive';
  }

  return 'negative';
}

export function formatDurationSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, cleanDuration(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function buildGameProtocol(players, rounds) {
  const playerSnapshot = getPlayerSnapshot(players);
  const blockSummaries = calculateBlockTotals(rounds);
  const blockSummaryMap = Object.fromEntries(blockSummaries.map((block) => [block.id, block]));

  return ROUND_PRESET.map((round) => {
    const blockSummary = blockSummaryMap[round.blockId];
    const isPremiumRound = round.id === blockSummary?.lastRoundId;

    return {
      roundId: round.id,
      hand: round.hand,
      cards: round.cards,
      blockId: round.blockId,
      blockLabel: round.blockLabel,
      dealerKey: round.dealerKey,
      dealerName: playerSnapshot[round.dealerKey],
      players: Object.fromEntries(
        PLAYER_KEYS.map((playerKey) => {
          const roundEntry = rounds?.[round.id]?.[playerKey] || {};
          const bid = normalizeInteger(roundEntry.bid);
          const tricks = normalizeInteger(roundEntry.tricks);
          const baseScore = calculatePlayerRoundScore(roundEntry, round.cards);
          const premiumScore = isPremiumRound ? blockSummary?.bonuses?.[playerKey] ?? 0 : 0;
          const cutScore = blockSummary?.cutRounds?.[playerKey]?.[round.id] ?? 0;
          const displayedScore = premiumScore > 0 ? premiumScore : baseScore;

          return [
            playerKey,
            {
              name: playerSnapshot[playerKey],
              bid,
              tricks,
              baseScore,
              premiumScore,
              cutScore,
              displayedScore,
              scoreType: getProtocolScoreType({
                bid,
                tricks,
                isPremium: premiumScore > 0,
                isCut: cutScore > 0
              })
            }
          ];
        })
      )
    };
  });
}

export function buildScoresPayload(players, rounds, counters = {}) {
  return JSON.stringify({
    rounds,
    warnings: normalizePlayerCounters(counters.warnings, { booleanAsOne: true }),
    penalties: normalizePlayerCounters(counters.penalties),
    protocol: buildGameProtocol(players, rounds)
  });
}

export function parseScoresPayload(rawScores, players) {
  if (!rawScores) {
    return {
      rounds: {},
      warnings: normalizePlayerCounters(),
      penalties: normalizePlayerCounters(),
      protocol: buildGameProtocol(players, {})
    };
  }

  try {
    const parsed = JSON.parse(rawScores);
    const rounds = parsed?.rounds && typeof parsed.rounds === 'object' ? parsed.rounds : parsed;
    const warnings = parsed?.rounds
      ? normalizePlayerCounters(parsed.warnings, { booleanAsOne: true })
      : normalizePlayerCounters();
    const penalties = parsed?.rounds ? normalizePlayerCounters(parsed.penalties) : normalizePlayerCounters();
    const protocol = Array.isArray(parsed?.protocol)
      ? parsed.protocol
      : buildGameProtocol(players, rounds || {});

    return {
      rounds: rounds || {},
      warnings,
      penalties,
      protocol
    };
  } catch {
    return {
      rounds: {},
      warnings: normalizePlayerCounters(),
      penalties: normalizePlayerCounters(),
      protocol: buildGameProtocol(players, {})
    };
  }
}

export function serializeGame(game) {
  const players = getPlayerSnapshot({
    player1: game.player1Name,
    player2: game.player2Name,
    player3: game.player3Name,
    player4: game.player4Name
  });
  const { rounds, warnings, penalties, protocol } = parseScoresPayload(game.scoresJson, players);

  return {
    id: game.id,
    title: game.title,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    durationSeconds: cleanDuration(game.durationSeconds),
    players,
    totals: {
      player1: game.player1Total,
      player2: game.player2Total,
      player3: game.player3Total,
      player4: game.player4Total
    },
    warnings,
    penalties,
    rounds,
    protocol
  };
}

export function buildGameCreateInput(payload) {
  const players = getPlayerSnapshot(payload?.players || {});
  const totals = payload?.totals || {};
  const createdAt = cleanDate(payload?.createdAt);

  return {
    title: cleanText(payload?.title, `Партия ${new Date().toLocaleString('ru-RU')}`),
    durationSeconds: cleanDuration(payload?.durationSeconds),
    player1Name: players.player1,
    player2Name: players.player2,
    player3Name: players.player3,
    player4Name: players.player4,
    player1Total: cleanNumber(totals.player1),
    player2Total: cleanNumber(totals.player2),
    player3Total: cleanNumber(totals.player3),
    player4Total: cleanNumber(totals.player4),
    scoresJson: buildScoresPayload(players, payload?.rounds || {}, {
      warnings: payload?.warnings,
      penalties: payload?.penalties
    }),
    ...(createdAt ? { createdAt } : {})
  };
}

export function buildAggregateTotals(games) {
  return PLAYER_KEYS.reduce((acc, playerKey) => {
    acc[playerKey] = games.reduce((sum, game) => sum + cleanNumber(game.totals?.[playerKey]), 0);
    return acc;
  }, {});
}
