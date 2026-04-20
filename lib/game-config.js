export const PLAYER_KEYS = ['player1', 'player2', 'player3', 'player4'];

const DEALER_ROTATION = ['player4', 'player1', 'player2', 'player3'];

const blocks = [
  {
    id: 'rise',
    label: 'Разгон 1-8 карт',
    rounds: [1, 2, 3, 4, 5, 6, 7, 8]
  },
  {
    id: 'nines-a',
    label: 'Четыре раздачи по 9 карт',
    rounds: [9, 9, 9, 9]
  },
  {
    id: 'fall',
    label: 'Спуск 8-1 карт',
    rounds: [8, 7, 6, 5, 4, 3, 2, 1]
  },
  {
    id: 'nines-b',
    label: 'Финальные четыре раздачи по 9 карт',
    rounds: [9, 9, 9, 9]
  }
];

export const DEFAULT_PLAYERS = {
  player1: 'Игрок 1',
  player2: 'Игрок 2',
  player3: 'Игрок 3',
  player4: 'Игрок 4'
};

export const ROUND_PRESET = blocks.flatMap((block, blockIndex) =>
  block.rounds.map((cards, roundIndex) => {
    const hand = getHandNumber(blockIndex, roundIndex);
    const dealerKey = DEALER_ROTATION[(hand - 1) % DEALER_ROTATION.length];
    const dealerIndex = PLAYER_KEYS.indexOf(dealerKey);
    const bidderOrder = PLAYER_KEYS.map((_, offset) => PLAYER_KEYS[(dealerIndex + 1 + offset) % PLAYER_KEYS.length]);

    return {
      id: `${block.id}-${roundIndex + 1}`,
      hand,
      cards,
      blockId: block.id,
      blockLabel: block.label,
      dealerKey,
      bidderOrder,
      lastBidderKey: bidderOrder[bidderOrder.length - 1]
    };
  })
);

function getHandNumber(blockIndex, roundIndex) {
  const roundsBefore = blocks
    .slice(0, blockIndex)
    .reduce((sum, block) => sum + block.rounds.length, 0);

  return roundsBefore + roundIndex + 1;
}

export const GAME_BLOCKS = blocks;
export const TOTAL_HANDS = ROUND_PRESET.length;

export function createEmptyRounds() {
  return Object.fromEntries(
    ROUND_PRESET.map((round) => [
      round.id,
      Object.fromEntries(
        PLAYER_KEYS.map((playerKey) => [
          playerKey,
          {
            bid: '',
            tricks: ''
          }
        ])
      )
    ])
  );
}

export function createEmptyGameState() {
  return {
    title: '',
    players: { ...DEFAULT_PLAYERS },
    warnings: Object.fromEntries(PLAYER_KEYS.map((playerKey) => [playerKey, 0])),
    rounds: createEmptyRounds()
  };
}

export function normalizeInteger(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const normalized = Number.parseInt(String(value), 10);
  return Number.isFinite(normalized) ? normalized : null;
}

export function getBaseContractScore(bid) {
  return 50 * (bid + 1);
}

export function calculatePlayerRoundScore(roundEntry, cards = null) {
  const bid = normalizeInteger(roundEntry?.bid);
  const tricks = normalizeInteger(roundEntry?.tricks);

  if (bid === null || tricks === null) {
    return null;
  }

  if (tricks < bid) {
    return -getBaseContractScore(bid);
  }

  if (tricks === bid) {
    if (cards !== null && bid === cards && tricks === cards) {
      return cards * 100;
    }

    return getBaseContractScore(bid);
  }

  return tricks * 10;
}

export function getLastBidRestriction(round, roundState) {
  const lastBidderKey = round.lastBidderKey;
  const otherBidSum = round.bidderOrder
    .filter((playerKey) => playerKey !== lastBidderKey)
    .reduce((sum, playerKey) => {
      return sum + (normalizeInteger(roundState?.[playerKey]?.bid) ?? 0);
    }, 0);

  const forbiddenBid = round.cards - otherBidSum;

  if (forbiddenBid < 0 || forbiddenBid > round.cards) {
    return null;
  }

  return forbiddenBid;
}

export function hasForbiddenLastBid(round, roundState) {
  const forbiddenBid = getLastBidRestriction(round, roundState);
  const currentLastBid = normalizeInteger(roundState?.[round.lastBidderKey]?.bid);

  return forbiddenBid !== null && currentLastBid === forbiddenBid;
}

export function getRoundTrickTotal(roundState) {
  return PLAYER_KEYS.reduce((sum, playerKey) => {
    return sum + (normalizeInteger(roundState?.[playerKey]?.tricks) ?? 0);
  }, 0);
}

export function isRoundTricksFilled(roundState) {
  return PLAYER_KEYS.every((playerKey) => normalizeInteger(roundState?.[playerKey]?.tricks) !== null);
}

export function getInvalidTrickTotalRounds(rounds, { onlyFilled = false } = {}) {
  return ROUND_PRESET.filter((round) => {
    const roundState = rounds?.[round.id];

    if (onlyFilled && !isRoundTricksFilled(roundState)) {
      return false;
    }

    return getRoundTrickTotal(roundState) !== round.cards;
  });
}

function isExactRound(roundEntry) {
  const bid = normalizeInteger(roundEntry?.bid);
  const tricks = normalizeInteger(roundEntry?.tricks);

  return bid !== null && tricks !== null && bid === tricks;
}

function isRoundFilled(roundEntry) {
  return normalizeInteger(roundEntry?.bid) !== null && normalizeInteger(roundEntry?.tricks) !== null;
}

function isBlockFilled(rounds, blockRounds) {
  return blockRounds.every((round) =>
    PLAYER_KEYS.every((playerKey) => isRoundFilled(rounds?.[round.id]?.[playerKey]))
  );
}

function getLargestStealableRound(rounds, blockRounds, playerKey, excludedRoundId = null) {
  return blockRounds.reduce((largestRound, round) => {
    if (round.id === excludedRoundId) {
      return largestRound;
    }

    const score = calculatePlayerRoundScore(rounds?.[round.id]?.[playerKey], round.cards);
    return score !== null && score > largestRound.score ? { roundId: round.id, score } : largestRound;
  }, { roundId: null, score: 0 });
}

function calculatePremiumAdjustments(rounds, blockRounds) {
  const bonuses = Object.fromEntries(PLAYER_KEYS.map((playerKey) => [playerKey, 0]));
  const penalties = Object.fromEntries(PLAYER_KEYS.map((playerKey) => [playerKey, 0]));
  const cutRounds = Object.fromEntries(PLAYER_KEYS.map((playerKey) => [playerKey, {}]));

  if (!isBlockFilled(rounds, blockRounds)) {
    return {
      bonuses,
      penalties,
      cutRounds,
      premiumTotals: { ...bonuses },
      winners: []
    };
  }

  const winners = PLAYER_KEYS.filter((playerKey) =>
    blockRounds.every((round) => isExactRound(rounds?.[round.id]?.[playerKey]))
  );
  const winnerSet = new Set(winners);
  const lastRound = blockRounds[blockRounds.length - 1];

  winners.forEach((playerKey) => {
    const ownLastScore = calculatePlayerRoundScore(rounds?.[lastRound.id]?.[playerKey], lastRound.cards) ?? 0;
    const playerIndex = PLAYER_KEYS.indexOf(playerKey);
    const nextPlayerKey = PLAYER_KEYS[(playerIndex + 1) % PLAYER_KEYS.length];
    const excludedRoundId = winnerSet.has(nextPlayerKey) ? lastRound.id : null;
    const nextPlayerLargestRound = getLargestStealableRound(rounds, blockRounds, nextPlayerKey, excludedRoundId);

    bonuses[playerKey] += (ownLastScore + nextPlayerLargestRound.score) * 2;
    penalties[nextPlayerKey] += nextPlayerLargestRound.score;

    if (nextPlayerLargestRound.roundId !== null && nextPlayerLargestRound.score > 0) {
      cutRounds[nextPlayerKey][nextPlayerLargestRound.roundId] =
        (cutRounds[nextPlayerKey][nextPlayerLargestRound.roundId] ?? 0) + nextPlayerLargestRound.score;
    }
  });

  return { bonuses, penalties, cutRounds, premiumTotals: { ...bonuses }, winners };
}

export function calculateBlockTotals(rounds) {
  const runningTotals = Object.fromEntries(PLAYER_KEYS.map((playerKey) => [playerKey, 0]));

  return GAME_BLOCKS.map((block) => {
    const blockRounds = ROUND_PRESET.filter((round) => round.blockId === block.id);
    const lastRound = blockRounds[blockRounds.length - 1];
    const { bonuses, penalties, cutRounds, premiumTotals, winners } = calculatePremiumAdjustments(rounds, blockRounds);

    const roundScoreTotals = PLAYER_KEYS.reduce((acc, playerKey) => {
      acc[playerKey] = blockRounds.reduce((sum, round) => {
        return sum + (calculatePlayerRoundScore(rounds?.[round.id]?.[playerKey], round.cards) ?? 0);
      }, 0);
      return acc;
    }, {});

    const lastRoundScores = PLAYER_KEYS.reduce((acc, playerKey) => {
      acc[playerKey] = calculatePlayerRoundScore(rounds?.[lastRound.id]?.[playerKey], lastRound.cards) ?? 0;
      return acc;
    }, {});

    const totals = PLAYER_KEYS.reduce((acc, playerKey) => {
      const premiumValue = bonuses[playerKey] ?? 0;
      const hasPremium = bonuses[playerKey] !== 0;
      acc[playerKey] = hasPremium
        ? roundScoreTotals[playerKey] - lastRoundScores[playerKey] + premiumValue - penalties[playerKey]
        : roundScoreTotals[playerKey] - penalties[playerKey];
      return acc;
    }, {});

    PLAYER_KEYS.forEach((playerKey) => {
      runningTotals[playerKey] += totals[playerKey] ?? 0;
    });

    return {
      ...block,
      lastRoundId: lastRound.id,
      roundScoreTotals,
      lastRoundScores,
      totals,
      runningTotals: { ...runningTotals },
      bonuses,
      penalties,
      cutRounds,
      premiumTotals,
      winners,
      isFilled: isBlockFilled(rounds, blockRounds)
    };
  });
}

export function calculateTotals(rounds) {
  const blockTotals = calculateBlockTotals(rounds);
  const lastBlock = blockTotals[blockTotals.length - 1];

  return lastBlock?.runningTotals ?? Object.fromEntries(PLAYER_KEYS.map((playerKey) => [playerKey, 0]));
}
