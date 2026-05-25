'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  GAME_BLOCKS,
  PLAYER_KEYS,
  ROUND_PRESET,
  calculateBlockTotals,
  calculatePlayerRoundScore,
  calculateTotals,
  createEmptyGameState,
  DEFAULT_PLAYERS,
  getLastBidRestriction,
  getInvalidTrickTotalRounds,
  getRoundTrickTotal,
  hasForbiddenLastBid,
  isRoundTricksFilled,
  normalizeInteger
} from '../lib/game-config';
import { formatDurationSeconds } from '../lib/game-storage';
import ScoreboardShell from './ScoreboardShell';

const DRAFT_STORAGE_KEY = 'joker-casino-current-game';
const PENALTY_POINTS = 250;

const playerAccent = {
  player1: 'playerAccentOne',
  player2: 'playerAccentTwo',
  player3: 'playerAccentThree',
  player4: 'playerAccentFour'
};

function readDraft() {
  const emptyGame = createEmptyGameState();

  if (typeof window === 'undefined') {
    return emptyGame;
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return emptyGame;
    }

    const parsed = JSON.parse(raw);
    return {
      ...emptyGame,
      ...parsed,
      players: { ...DEFAULT_PLAYERS, ...(parsed.players || {}) },
      warnings: normalizeWarnings(parsed.warnings, emptyGame.warnings),
      penalties: normalizePenalties(parsed.penalties, emptyGame.penalties),
      rounds: { ...emptyGame.rounds, ...(parsed.rounds || {}) }
    };
  } catch {
    return emptyGame;
  }
}

function normalizeWarnings(savedWarnings, fallbackWarnings) {
  return PLAYER_KEYS.reduce((acc, playerKey) => {
    const value = savedWarnings?.[playerKey];

    if (typeof value === 'boolean') {
      acc[playerKey] = value ? 1 : 0;
      return acc;
    }

    const parsed = Number.parseInt(String(value ?? fallbackWarnings[playerKey] ?? 0), 10);
    acc[playerKey] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    return acc;
  }, {});
}

function normalizePenalties(savedPenalties, fallbackPenalties) {
  return PLAYER_KEYS.reduce((acc, playerKey) => {
    const parsed = Number.parseInt(String(savedPenalties?.[playerKey] ?? fallbackPenalties[playerKey] ?? 0), 10);
    acc[playerKey] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    return acc;
  }, {});
}

function getPenaltyPoints(penalties, playerKey) {
  const penaltyCount = Number.parseInt(String(penalties?.[playerKey] ?? 0), 10);
  return Number.isFinite(penaltyCount) && penaltyCount > 0 ? penaltyCount * PENALTY_POINTS : 0;
}

function applyPlayerPenalties(totals, penalties) {
  return PLAYER_KEYS.reduce((acc, playerKey) => {
    acc[playerKey] = (totals?.[playerKey] ?? 0) - getPenaltyPoints(penalties, playerKey);
    return acc;
  }, {});
}

function getNumberOptions(max) {
  return Array.from({ length: max + 1 }, (_, value) => value);
}

function isRoundComplete(round, rounds) {
  const roundState = rounds?.[round.id];

  if (!roundState) {
    return false;
  }

  const areBidsFilled = PLAYER_KEYS.every((playerKey) => normalizeInteger(roundState?.[playerKey]?.bid) !== null);
  const areTricksFilled = isRoundTricksFilled(roundState);

  if (!areBidsFilled || !areTricksFilled) {
    return false;
  }

  if (getRoundTrickTotal(roundState) !== round.cards) {
    return false;
  }

  return !hasForbiddenLastBid(round, roundState);
}

function getCurrentBlockPremiumContenders(rounds, currentRoundId) {
  const currentRound = ROUND_PRESET.find((round) => round.id === currentRoundId) ?? ROUND_PRESET[0];
  const blockRounds = ROUND_PRESET.filter((round) => round.blockId === currentRound.blockId);
  const currentRoundIndex = blockRounds.findIndex((round) => round.id === currentRound.id);
  const playedBlockRounds = blockRounds.slice(0, currentRoundIndex + 1);

  return Object.fromEntries(
    PLAYER_KEYS.map((playerKey) => [
      playerKey,
      playedBlockRounds.every((round) => {
        const roundEntry = rounds?.[round.id]?.[playerKey];
        const bid = normalizeInteger(roundEntry?.bid);
        const tricks = normalizeInteger(roundEntry?.tricks);

        if (bid === null || tricks === null) {
          return true;
        }

        return bid === tricks;
      })
    ])
  );
}

function getRandomInteger(max) {
  return Math.floor(Math.random() * (max + 1));
}

function getRandomArrayItem(items) {
  return items[getRandomInteger(items.length - 1)];
}

function getElapsedSeconds(game, nowTimestamp = Date.now()) {
  if (!game?.startedAt) {
    return 0;
  }

  const startedAt = new Date(game.startedAt).getTime();

  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  const finishedAt = game.endedAt ? new Date(game.endedAt).getTime() : nowTimestamp;
  const effectiveEnd = Number.isFinite(finishedAt) ? finishedAt : nowTimestamp;

  return Math.max(0, Math.floor((effectiveEnd - startedAt) / 1000));
}

function shuffleItems(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomInteger(index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createRandomRoundState(round) {
  const roundState = Object.fromEntries(
    PLAYER_KEYS.map((playerKey) => [
      playerKey,
      {
        bid: '',
        tricks: ''
      }
    ])
  );
  const lastBidderKey = round.lastBidderKey;

  round.bidderOrder
    .filter((playerKey) => playerKey !== lastBidderKey)
    .forEach((playerKey) => {
      roundState[playerKey].bid = String(getRandomInteger(round.cards));
    });

  const forbiddenBid = getLastBidRestriction(round, roundState);
  const lastBidOptions = getNumberOptions(round.cards).filter((value) => value !== forbiddenBid);
  roundState[lastBidderKey].bid = String(getRandomArrayItem(lastBidOptions));

  let remainingTricks = round.cards;
  const trickOrder = shuffleItems(PLAYER_KEYS);

  trickOrder.forEach((playerKey, index) => {
    const tricks = index === trickOrder.length - 1 ? remainingTricks : getRandomInteger(remainingTricks);
    roundState[playerKey].tricks = String(tricks);
    remainingTricks -= tricks;
  });

  return roundState;
}

function createRandomRounds() {
  return Object.fromEntries(ROUND_PRESET.map((round) => [round.id, createRandomRoundState(round)]));
}

export default function GameBoard({ registeredPlayers = [], readOnly = false }) {
  const [currentGame, setCurrentGame] = useState(createEmptyGameState());
  const [savedGames, setSavedGames] = useState([]);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState('');
  const [timerNow, setTimerNow] = useState(() => Date.now());

  useEffect(() => {
    setCurrentGame(readDraft());
    loadSavedGames();
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(currentGame));
  }, [currentGame, ready]);

  useEffect(() => {
    if (currentGame.status !== 'active') {
      return undefined;
    }

    setTimerNow(Date.now());

    const intervalId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [currentGame.status]);

  async function loadSavedGames() {
    try {
      const response = await fetch('/api/games', { cache: 'no-store' });
      const data = await response.json();
      setSavedGames(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load games', error);
      setFlash('Не удалось загрузить архив партий.');
    }
  }

  const baseTotals = useMemo(() => calculateTotals(currentGame.rounds), [currentGame.rounds]);
  const totals = useMemo(
    () => applyPlayerPenalties(baseTotals, currentGame.penalties),
    [baseTotals, currentGame.penalties]
  );
  const blockTotals = useMemo(() => calculateBlockTotals(currentGame.rounds), [currentGame.rounds]);
  const invalidLastBidRounds = useMemo(
    () => ROUND_PRESET.filter((round) => hasForbiddenLastBid(round, currentGame.rounds[round.id])),
    [currentGame.rounds]
  );
  const invalidCompletedTrickRounds = useMemo(
    () => getInvalidTrickTotalRounds(currentGame.rounds, { onlyFilled: true }),
    [currentGame.rounds]
  );
  const invalidSavableTrickRounds = useMemo(
    () => getInvalidTrickTotalRounds(currentGame.rounds),
    [currentGame.rounds]
  );
  const currentRoundId = useMemo(
    () => ROUND_PRESET.find((round) => !isRoundComplete(round, currentGame.rounds))?.id ?? ROUND_PRESET[ROUND_PRESET.length - 1]?.id,
    [currentGame.rounds]
  );
  const premiumContenders = useMemo(
    () => getCurrentBlockPremiumContenders(currentGame.rounds, currentRoundId),
    [currentGame.rounds, currentRoundId]
  );
  const gameDurationSeconds = useMemo(
    () => getElapsedSeconds(currentGame, timerNow),
    [currentGame, timerNow]
  );
  const tableLocked = readOnly || currentGame.status === 'idle';
  const canSaveGame = !readOnly && currentGame.status === 'finished';

  function updatePlayer(playerKey, value) {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => ({
      ...prev,
      players: {
        ...prev.players,
        [playerKey]: value
      }
    }));
  }

  function updateTitle(value) {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => ({ ...prev, title: value }));
  }

  function addPlayerWarning(playerKey) {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => ({
      ...prev,
      warnings: {
        ...prev.warnings,
        [playerKey]: (prev.warnings?.[playerKey] || 0) + 1
      }
    }));
  }

  function removePlayerWarning(playerKey) {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => ({
      ...prev,
      warnings: {
        ...prev.warnings,
        [playerKey]: Math.max(0, (prev.warnings?.[playerKey] || 0) - 1)
      }
    }));
  }

  function addPlayerPenalty(playerKey) {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => ({
      ...prev,
      penalties: {
        ...prev.penalties,
        [playerKey]: (prev.penalties?.[playerKey] || 0) + 1
      }
    }));
  }

  function removePlayerPenalty(playerKey) {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => ({
      ...prev,
      penalties: {
        ...prev.penalties,
        [playerKey]: Math.max(0, (prev.penalties?.[playerKey] || 0) - 1)
      }
    }));
  }

  function updateRoundValue(roundId, playerKey, field, value) {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => {
      if (prev.status === 'idle') {
        return prev;
      }

      return {
        ...prev,
        rounds: {
          ...prev.rounds,
          [roundId]: {
            ...prev.rounds[roundId],
            [playerKey]: {
              ...prev.rounds[roundId][playerKey],
              [field]: value
            }
          }
        }
      };
    });
  }

  function startGame() {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => {
      if (prev.status !== 'idle') {
        return prev;
      }

      return {
        ...prev,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null
      };
    });
    setTimerNow(Date.now());
    setFlash('Игра началась. Таблица разблокирована.');
  }

  function endGame() {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => {
      if (prev.status !== 'active') {
        return prev;
      }

      return {
        ...prev,
        status: 'finished',
        endedAt: new Date().toISOString()
      };
    });
    setTimerNow(Date.now());
    setFlash('Игра завершена. Теперь партию можно сохранить в базу.');
  }

  function resetCurrentGame() {
    if (readOnly) {
      return;
    }

    if (!window.confirm('Очистить текущую таблицу? Все заполненные значения будут сброшены.')) {
      return;
    }

    setCurrentGame(createEmptyGameState());
    setFlash('Текущая партия очищена.');
  }

  function fillRandomGame() {
    if (readOnly) {
      return;
    }

    if (currentGame.status === 'idle') {
      setFlash('Сначала нажми «Начать игру», чтобы открыть таблицу.');
      return;
    }

    if (!window.confirm('Заполнить таблицу случайными данными? Текущие значения раздач будут заменены.')) {
      return;
    }

    setCurrentGame((prev) => ({
      ...prev,
      rounds: createRandomRounds()
    }));
    setFlash('Таблица заполнена случайными корректными данными.');
  }

  async function saveGame() {
    if (readOnly) {
      setFlash('Что бы начать играть авторизируйтесь.');
      return;
    }

    if (currentGame.status !== 'finished') {
      setFlash('Сначала закончи игру, чтобы сохранить ее в базу.');
      return;
    }

    if (invalidLastBidRounds.length > 0) {
      setFlash('Исправь последний заказ: сумма заказов не должна равняться числу карт в раздаче.');
      return;
    }

    if (invalidSavableTrickRounds.length > 0) {
      setFlash('Исправь взятки: сумма взятых карт должна точно совпадать с количеством карт в раздаче.');
      return;
    }

    const gameTitle = currentGame.title.trim() || `Партия ${savedGames.length + 1}`;

    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: gameTitle,
          players: currentGame.players,
          totals,
          rounds: currentGame.rounds,
          durationSeconds: gameDurationSeconds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save game');
      }

      const createdGame = await response.json();
      setSavedGames((prev) => [createdGame, ...prev]);
      setCurrentGame(createEmptyGameState());
      setFlash(`Партия «${gameTitle}» сохранена в базу.`);
    } catch (error) {
      console.error(error);
      setFlash('Не удалось сохранить партию в базу.');
    }
  }

  useEffect(() => {
    if (!flash) {
      return;
    }

    const timeout = window.setTimeout(() => setFlash(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  return (
    <ScoreboardShell active="game">
      <section className="panelGrid panelGridTop">
        <div className="panelCard panelCardWide">
          <div className="panelHeader">
            <div>
              <p className="sectionEyebrow">Стол игроков</p>
              <h2 className="sectionTitle">Состав партии</h2>
            </div>
            {flash ? <span className="flashBadge">{flash}</span> : null}
          </div>
          <div className="playersGrid">
            {PLAYER_KEYS.map((playerKey) => (
              <div className={`playerCard ${playerAccent[playerKey]}`} key={playerKey}>
                <span className="fieldLabel">{playerKey.replace('player', 'Игрок ')}</span>
                <select
                  className="textField"
                  value={currentGame.players[playerKey]}
                  onChange={(event) => updatePlayer(playerKey, event.target.value)}
                  disabled={readOnly}
                >
                  <option value={DEFAULT_PLAYERS[playerKey]}>{DEFAULT_PLAYERS[playerKey]}</option>
                  {registeredPlayers.map((player) => (
                    <option key={`${playerKey}-${player.id}`} value={player.username}>
                      {player.username}
                    </option>
                  ))}
                </select>
                <div className="playerActionRow">
                  <button
                    type="button"
                    className={`warningActionButton ${currentGame.warnings?.[playerKey] > 0 ? 'warningActionButtonActive' : ''}`}
                    onClick={() => addPlayerWarning(playerKey)}
                    disabled={readOnly}
                  >
                    <ChickenHeadIcon />
                    <span>Вынести предупреждение</span>
                  </button>
                  <button
                    type="button"
                    className={`penaltyActionButton ${currentGame.penalties?.[playerKey] > 0 ? 'penaltyActionButtonActive' : ''}`}
                    onClick={() => addPlayerPenalty(playerKey)}
                    disabled={readOnly}
                  >
                    <span className="penaltyButtonMark">-250</span>
                    <span>Штраф</span>
                  </button>
                </div>
                {currentGame.warnings?.[playerKey] > 0 || currentGame.penalties?.[playerKey] > 0 ? (
                  <div className="playerUndoActions">
                    {currentGame.warnings?.[playerKey] > 0 ? (
                      <button
                        type="button"
                        className="warningUndoButton"
                        onClick={() => removePlayerWarning(playerKey)}
                        disabled={readOnly}
                      >
                        Снять одно предупреждение
                      </button>
                    ) : null}
                    {currentGame.penalties?.[playerKey] > 0 ? (
                      <button
                        type="button"
                        className="penaltyUndoButton"
                        onClick={() => removePlayerPenalty(playerKey)}
                        disabled={readOnly}
                      >
                        Снять один штраф
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <label className="titleField">
            <span className="fieldLabel">Название партии</span>
            <input
              className="textField"
              value={currentGame.title}
              onChange={(event) => updateTitle(event.target.value)}
              placeholder="Например, Пятничная игра в джокер"
              disabled={readOnly}
            />
          </label>
        </div>

        <div className="panelCard">
          <p className="sectionEyebrow">Итоги партии</p>
          <h2 className="sectionTitle">Общий счет</h2>
          {readOnly ? (
            <div className="readOnlyNotice">
              Что бы начать играть авторизируйтесь.
            </div>
          ) : null}
          <div className="gameSessionPanel">
            <div className="gameSessionMeta">
              <div className="gameSessionItem">
                <span className="gameSessionLabel">Статус игры</span>
                <strong className={`gameSessionValue gameSessionValueStatus gameStatus${currentGame.status}`}>
                  {currentGame.status === 'idle'
                    ? 'Не начата'
                    : currentGame.status === 'active'
                      ? 'Идет игра'
                      : 'Завершена'}
                </strong>
              </div>
              <div className="gameSessionItem">
                <span className="gameSessionLabel">Время игры</span>
                <strong className="gameSessionValue gameSessionTimer">
                  {formatDurationSeconds(gameDurationSeconds)}
                </strong>
              </div>
            </div>
            <div className="gameSessionActions">
              <button
                type="button"
                className="secondaryButton compactActionButton"
                onClick={startGame}
                disabled={readOnly || currentGame.status !== 'idle'}
              >
                Начать игру
              </button>
              <button
                type="button"
                className="secondaryButton compactActionButton"
                onClick={endGame}
                disabled={readOnly || currentGame.status !== 'active'}
              >
                Закончить игру
              </button>
            </div>
          </div>
          {!readOnly && currentGame.status === 'idle' ? (
            <div className="readOnlyNotice">
              Таблица очков заблокирована, пока игра не начата.
            </div>
          ) : null}
          <div className="totalsStack">
            {PLAYER_KEYS.map((playerKey) => {
              const penaltyPoints = getPenaltyPoints(currentGame.penalties, playerKey);

              return (
                <div className="totalRow" key={playerKey}>
                  <span className="totalPlayerName">
                    {currentGame.players[playerKey] || DEFAULT_PLAYERS[playerKey]}
                    {currentGame.warnings?.[playerKey] > 0 ? (
                      <ChickenWarningStack count={currentGame.warnings[playerKey]} />
                    ) : null}
                    {penaltyPoints > 0 ? (
                      <span className="playerPenaltyTag" title={`Штрафов: ${currentGame.penalties[playerKey]}`}>
                        -{penaltyPoints}
                      </span>
                    ) : null}
                  </span>
                  <strong>{totals[playerKey]}</strong>
                </div>
              );
            })}
          </div>
          {invalidLastBidRounds.length > 0 ? (
            <div className="warningBox">
              Есть {invalidLastBidRounds.length} раздач(и), где последний заказ делает сумму ровно по картам. Это нужно исправить до сохранения.
            </div>
          ) : null}
          {invalidCompletedTrickRounds.length > 0 ? (
            <div className="warningBox">
              Есть {invalidCompletedTrickRounds.length} раздач(и), где сумма взятых карт не совпадает с количеством карт в раздаче.
            </div>
          ) : null}
          <div className="buttonRow buttonRowVertical">
            <button type="button" className="primaryButton" onClick={saveGame} disabled={!canSaveGame}>
              Сохранить партию в базу
            </button>
            <div className="secondaryActionsRow">
              <button
                type="button"
                className="secondaryButton compactActionButton"
                onClick={fillRandomGame}
                disabled={readOnly || currentGame.status === 'idle'}
              >
                Заполнить случайно
              </button>
              <button type="button" className="secondaryButton compactActionButton" onClick={resetCurrentGame} disabled={readOnly}>
                Очистить таблицу
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="tablePanel">
        {tableLocked && !readOnly ? (
          <div className="tableLockNotice">
            Нажми «Начать игру», чтобы разблокировать таблицу и начать отсчет времени.
          </div>
        ) : null}
        <div className="scoreTableStickyHeader" aria-hidden="true">
          <div className="scoreTableStickyCell scoreTableStickyMeta">Карты</div>
          {PLAYER_KEYS.map((playerKey) => (
            <div className="scoreTableStickyCell" key={`sticky-${playerKey}`}>
              <div className="playerColumnHeader">
                <span className="playerHeaderTopline">
                  <span>{currentGame.players[playerKey] || DEFAULT_PLAYERS[playerKey]}</span>
                  <span className="playerHeaderTotal">
                    {totals[playerKey]}
                    {premiumContenders[playerKey] ? <span className="premiumMarker" aria-label="Претендует на премию" title="Претендует на премию">💰</span> : null}
                  </span>
                </span>
                <span className="playerColumnSubheads">
                  <span>Заказ</span>
                  <span>Взятка</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="scoreboardWrap">
          <div className="scoreTableBlocks">
            {GAME_BLOCKS.map((block) => {
              const blockRounds = ROUND_PRESET.filter((round) => round.blockId === block.id);
              const blockSummary = blockTotals.find((item) => item.id === block.id);

              return (
                <div className="scoreTableBlock" key={block.id}>
                  <table className="scoreTable enhancedTable simplifiedTable">
                    <tbody>
                      {blockRounds.map((round, index) => (
                        <RoundRows
                          key={round.id}
                          round={round}
                          currentGame={currentGame}
                          updateRoundValue={updateRoundValue}
                          readOnly={tableLocked}
                          showBlockSummary={index === blockRounds.length - 1}
                          blockSummary={blockSummary}
                          isCurrentRound={round.id === currentRoundId}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mobileRoundsStack">
          {GAME_BLOCKS.map((block) => {
            const blockRounds = ROUND_PRESET.filter((round) => round.blockId === block.id);
            const blockSummary = blockTotals.find((item) => item.id === block.id);

            return (
              <div className="mobileBlockSection" key={`mobile-${block.id}`}>
                {blockRounds.map((round, index) => (
                  <RoundCard
                    key={`mobile-${round.id}`}
                    round={round}
                    currentGame={currentGame}
                    updateRoundValue={updateRoundValue}
                    readOnly={tableLocked}
                    showBlockSummary={index === blockRounds.length - 1}
                    blockSummary={blockSummary}
                    isCurrentRound={round.id === currentRoundId}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </section>

    </ScoreboardShell>
  );
}

function ChickenHeadIcon({ className = 'chickenIcon' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path
        className="chickenComb"
        d="M12.5 8.2c-.9-2.7.4-5.2 2-5.2 1.2 0 1.8 1.1 1.8 2.2.6-1.1 1.5-1.9 2.6-1.6 1.6.4 1.9 2.7.4 4.8 1.4-.2 2.8.4 3 1.7.3 1.8-2 3.1-4.8 2.5"
      />
      <path
        className="chickenHead"
        d="M7.5 18.1c0-5 3.9-8.4 8.8-8.4 4.5 0 8.2 3.5 8.2 8.1 0 4.8-3.7 8.7-8.6 8.7-4.8 0-8.4-3.6-8.4-8.4Z"
      />
      <path className="chickenBeak" d="M24 17.2 29 19l-5 2" />
      <circle className="chickenEye" cx="18.8" cy="16" r="1.4" />
      <path className="chickenWattle" d="M14 25.4c.2 2 1.2 3.6 2.7 3.6s2.3-1.3 2.5-3.4" />
    </svg>
  );
}

function ChickenWarningStack({ count }) {
  return (
    <span className="chickenWarningStack" title={`Предупреждений: ${count}`} aria-label={`Предупреждений: ${count}`}>
      {Array.from({ length: Math.min(count, 3) }, (_, index) => (
        <span className="chickenWarningBadge" key={index}>
          <ChickenHeadIcon className="chickenIcon chickenIconBadge" />
        </span>
      ))}
      {count > 3 ? <span className="chickenWarningMore">+{count - 3}</span> : null}
    </span>
  );
}

function RoundRows({
  round,
  currentGame,
  updateRoundValue,
  readOnly,
  showBlockSummary,
  blockSummary,
  isCurrentRound
}) {
  const roundState = currentGame.rounds[round.id];
  const forbiddenLastBid = getLastBidRestriction(round, roundState);
  const trickTotal = getRoundTrickTotal(roundState);
  const areTricksFilled = isRoundTricksFilled(roundState);
  const hasInvalidTrickTotal = areTricksFilled && trickTotal !== round.cards;

  return (
    <>
      <tr className={isCurrentRound ? 'currentRoundRow' : ''}>
        <td>
          <div className="roundIndexCell">
            <div className={`roundBadge ${isCurrentRound ? 'roundBadgeCurrent' : ''}`}>{round.cards}</div>
            <span className="dealerLabel">Раздает</span>
            <span className="dealerPill">{currentGame.players[round.dealerKey] || DEFAULT_PLAYERS[round.dealerKey]}</span>
            {hasInvalidTrickTotal ? (
              <span className="rowWarning">Взято {trickTotal} из {round.cards}</span>
            ) : null}
            {forbiddenLastBid !== null && hasForbiddenLastBid(round, roundState) ? (
              <span className="rowWarning">Последнему нельзя {forbiddenLastBid}</span>
            ) : null}
          </div>
        </td>
        {PLAYER_KEYS.map((playerKey) => {
          return (
            <td key={playerKey}>
              <RoundPlayerFields
                round={round}
                currentGame={currentGame}
                playerKey={playerKey}
                updateRoundValue={updateRoundValue}
                readOnly={readOnly}
                blockSummary={blockSummary}
                forbiddenLastBid={forbiddenLastBid}
                hasInvalidTrickTotal={hasInvalidTrickTotal}
              />
            </td>
          );
        })}
      </tr>

      {showBlockSummary ? (
        <tr className="summaryRow">
          <td>
            <div className="summaryLabel">Итого</div>
          </td>
          {PLAYER_KEYS.map((playerKey) => (
            <td key={`${round.id}-${playerKey}`}>
              <strong>{blockSummary?.runningTotals[playerKey] ?? 0}</strong>
            </td>
          ))}
        </tr>
      ) : null}
    </>
  );
}

function RoundCard({ round, currentGame, updateRoundValue, readOnly, showBlockSummary, blockSummary, isCurrentRound }) {
  const roundState = currentGame.rounds[round.id];
  const forbiddenLastBid = getLastBidRestriction(round, roundState);
  const trickTotal = getRoundTrickTotal(roundState);
  const areTricksFilled = isRoundTricksFilled(roundState);
  const hasInvalidTrickTotal = areTricksFilled && trickTotal !== round.cards;

  return (
    <article className={isCurrentRound ? 'mobileRoundCard mobileRoundCardCurrent' : 'mobileRoundCard'}>
      <div className="mobileRoundHeader">
        <div>
          <span className="mobileRoundEyebrow">{round.cards} карт</span>
          <span className="dealerLabel">Раздает</span>
          <span className="dealerPill">{currentGame.players[round.dealerKey] || DEFAULT_PLAYERS[round.dealerKey]}</span>
        </div>
      </div>

      {hasInvalidTrickTotal ? (
        <span className="rowWarning mobileRoundWarning">Взято {trickTotal} из {round.cards}</span>
      ) : null}
      {forbiddenLastBid !== null && hasForbiddenLastBid(round, roundState) ? (
        <span className="rowWarning mobileRoundWarning">Последнему нельзя {forbiddenLastBid}</span>
      ) : null}

      <div className="mobileRoundPlayers">
        {PLAYER_KEYS.map((playerKey) => (
          <RoundPlayerFields
            key={`${round.id}-${playerKey}`}
            round={round}
            currentGame={currentGame}
            playerKey={playerKey}
            updateRoundValue={updateRoundValue}
            readOnly={readOnly}
            blockSummary={blockSummary}
            forbiddenLastBid={forbiddenLastBid}
            hasInvalidTrickTotal={hasInvalidTrickTotal}
            showPlayerName
          />
        ))}
      </div>

      {showBlockSummary ? (
        <div className="mobileBlockSummary">
          <span className="summaryLabel">Итого</span>
          <div className="mobileBlockSummaryGrid">
            {PLAYER_KEYS.map((playerKey) => (
              <span key={`${round.id}-mobile-${playerKey}`}>
                <small>{currentGame.players[playerKey] || DEFAULT_PLAYERS[playerKey]}</small>
                <strong>{blockSummary?.runningTotals[playerKey] ?? 0}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function RoundPlayerFields({
  round,
  currentGame,
  playerKey,
  updateRoundValue,
  readOnly,
  blockSummary,
  forbiddenLastBid,
  hasInvalidTrickTotal,
  showPlayerName = false
}) {
  const roundState = currentGame.rounds[round.id];
  const roundEntry = roundState[playerKey];
  const score = calculatePlayerRoundScore(roundEntry, round.cards);
  const isLastBidder = playerKey === round.lastBidderKey;
  const currentBid = normalizeInteger(roundEntry.bid);
  const hasForbiddenBid = isLastBidder && forbiddenLastBid !== null && currentBid === forbiddenLastBid;
  const premiumScore = blockSummary?.bonuses?.[playerKey] ?? 0;
  const cutScore = blockSummary?.cutRounds?.[playerKey]?.[round.id] ?? 0;
  const isPremiumScore = premiumScore > 0 && round.id === blockSummary?.lastRoundId;
  const isCutScore = cutScore > 0;
  const isInvalidScore = hasForbiddenBid || hasInvalidTrickTotal;
  const displayScore = isInvalidScore ? '—' : isPremiumScore ? premiumScore : score ?? '—';
  const playerName = currentGame.players[playerKey] || DEFAULT_PLAYERS[playerKey];
  const bid = normalizeInteger(roundEntry.bid);
  const tricks = normalizeInteger(roundEntry.tricks);
  const forcedTrickValue = getForcedTrickValue(round, roundState, playerKey);

  return (
    <div className={`roundPlayerCell compactRoundPlayerCell ${showPlayerName ? 'mobileRoundPlayerCell' : ''}`}>
      {showPlayerName ? <span className="mobileRoundPlayerName">{playerName}</span> : null}
      <div className="inlineFieldsRow">
        <label className="miniFieldGroup inlineFieldGroup">
          <span className="mobileMiniLabel">Заказ</span>
          <select
            aria-label={`${playerName} заказ`}
            className={`miniSelect ${hasForbiddenBid ? 'miniSelectInvalid' : ''}`}
            value={roundEntry.bid}
            onChange={(event) => updateRoundValue(round.id, playerKey, 'bid', event.target.value)}
            disabled={readOnly}
          >
            <option value="">-</option>
            {getNumberOptions(round.cards).map((value) => (
              <option
                key={value}
                value={value}
                disabled={isLastBidder && forbiddenLastBid !== null && value === forbiddenLastBid}
              >
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="miniFieldGroup inlineFieldGroup">
          <span className="mobileMiniLabel">Взятка</span>
          <select
            aria-label={`${playerName} взятка`}
            className="miniSelect"
            value={roundEntry.tricks}
            onChange={(event) => updateRoundValue(round.id, playerKey, 'tricks', event.target.value)}
            disabled={readOnly}
          >
            <option value="">-</option>
            {getNumberOptions(round.cards).map((value) => (
              <option
                key={value}
                value={value}
                disabled={forcedTrickValue !== null && value !== forcedTrickValue}
              >
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={`scoreBadge roundPlayerScore ${getScoreBadgeClass(isInvalidScore, { isPremium: isPremiumScore, isCut: isCutScore, bid, tricks })}`}>
        {displayScore}
      </div>
    </div>
  );
}

function getScoreBadgeClass(isInvalid, { isPremium = false, isCut = false, bid = null, tricks = null } = {}) {
  if (isInvalid) {
    return 'scoreBadgeInvalid';
  }

  if (bid === null || tricks === null) {
    return 'scoreBadgeSoft';
  }

  if (isCut) {
    return 'scoreBadgeCut';
  }

  if (isPremium) {
    return 'scoreBadgePremium';
  }

  if (tricks === bid) {
    return 'scoreBadgePositive';
  }

  return 'scoreBadgeNegative';
}

function getForcedTrickValue(round, roundState, playerKey) {
  const otherPlayerKeys = PLAYER_KEYS.filter((key) => key !== playerKey);
  const otherTricks = otherPlayerKeys.map((key) => normalizeInteger(roundState?.[key]?.tricks));

  if (otherTricks.some((value) => value === null)) {
    return null;
  }

  const remainingTricks = round.cards - otherTricks.reduce((sum, value) => sum + value, 0);

  if (remainingTricks < 0 || remainingTricks > round.cards) {
    return null;
  }

  return remainingTricks;
}
