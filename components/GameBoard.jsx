'use client';

import { useEffect, useMemo, useState } from 'react';
import {
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
import ScoreboardShell from './ScoreboardShell';

const DRAFT_STORAGE_KEY = 'joker-casino-current-game';

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

function getNumberOptions(max) {
  return Array.from({ length: max + 1 }, (_, value) => value);
}

function getRandomInteger(max) {
  return Math.floor(Math.random() * (max + 1));
}

function getRandomArrayItem(items) {
  return items[getRandomInteger(items.length - 1)];
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

  const totals = useMemo(() => calculateTotals(currentGame.rounds), [currentGame.rounds]);
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

  function updateRoundValue(roundId, playerKey, field, value) {
    if (readOnly) {
      return;
    }

    setCurrentGame((prev) => ({
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
    }));
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
          rounds: currentGame.rounds
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
                <button
                  type="button"
                  className={`warningActionButton ${currentGame.warnings?.[playerKey] > 0 ? 'warningActionButtonActive' : ''}`}
                  onClick={() => addPlayerWarning(playerKey)}
                  disabled={readOnly}
                >
                  <ChickenHeadIcon />
                  <span>Вынести предупреждение</span>
                </button>
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
          <div className="totalsStack">
            {PLAYER_KEYS.map((playerKey) => (
              <div className="totalRow" key={playerKey}>
                <span className="totalPlayerName">
                  {currentGame.players[playerKey] || DEFAULT_PLAYERS[playerKey]}
                  {currentGame.warnings?.[playerKey] > 0 ? (
                    <ChickenWarningStack count={currentGame.warnings[playerKey]} />
                  ) : null}
                </span>
                <strong>{totals[playerKey]}</strong>
              </div>
            ))}
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
            <button type="button" className="primaryButton" onClick={saveGame} disabled={readOnly}>
              Сохранить партию в базу
            </button>
            <button type="button" className="secondaryButton compactActionButton" onClick={fillRandomGame} disabled={readOnly}>
              Заполнить таблицу случайными данными
            </button>
            <button type="button" className="secondaryButton compactActionButton" onClick={resetCurrentGame} disabled={readOnly}>
              Очистить текущую таблицу
            </button>
          </div>
        </div>
      </section>

      <section className="tablePanel">
        <div className="scoreboardWrap">
          <table className="scoreTable enhancedTable simplifiedTable">
            <thead>
              <tr>
                <th>Ход</th>
                <th>Раздает</th>
                {PLAYER_KEYS.map((playerKey) => (
                  <th key={playerKey}>
                    <div className="playerColumnHeader">
                      <span>{currentGame.players[playerKey] || DEFAULT_PLAYERS[playerKey]}</span>
                      <span className="playerColumnSubheads">
                        <span>Заказ</span>
                        <span>Взятка</span>
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROUND_PRESET.map((round, index) => {
                const showBlockSummary =
                  index === ROUND_PRESET.length - 1 ||
                  ROUND_PRESET[index + 1].blockId !== round.blockId;
                const blockSummary = blockTotals.find((block) => block.id === round.blockId);

                return (
                  <RoundRows
                    key={round.id}
                    round={round}
                    currentGame={currentGame}
                    updateRoundValue={updateRoundValue}
                    readOnly={readOnly}
                    showBlockSummary={showBlockSummary}
                    blockSummary={blockSummary}
                  />
                );
              })}
            </tbody>
          </table>
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

function RoundRows({ round, currentGame, updateRoundValue, readOnly, showBlockSummary, blockSummary }) {
  const roundState = currentGame.rounds[round.id];
  const forbiddenLastBid = getLastBidRestriction(round, roundState);
  const trickTotal = getRoundTrickTotal(roundState);
  const areTricksFilled = isRoundTricksFilled(roundState);
  const hasInvalidTrickTotal = areTricksFilled && trickTotal !== round.cards;

  return (
    <>
      <tr>
        <td>
          <div className="roundBadge">{round.cards}</div>
        </td>
        <td>
          <div className="dealerCell">
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

          return (
            <td key={playerKey}>
              <div className="roundPlayerCell compactRoundPlayerCell">
                <div className="inlineFieldsRow">
                  <div className="miniFieldGroup inlineFieldGroup">
                    <select
                      aria-label={`${currentGame.players[playerKey] || DEFAULT_PLAYERS[playerKey]} заказ`}
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
                  </div>

                  <div className="miniFieldGroup inlineFieldGroup">
                    <select
                      aria-label={`${currentGame.players[playerKey] || DEFAULT_PLAYERS[playerKey]} взятка`}
                      className="miniSelect"
                      value={roundEntry.tricks}
                      onChange={(event) => updateRoundValue(round.id, playerKey, 'tricks', event.target.value)}
                      disabled={readOnly}
                    >
                      <option value="">-</option>
                      {getNumberOptions(round.cards).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={`scoreBadge roundPlayerScore ${getScoreBadgeClass(score, isInvalidScore, {
                  isPremium: isPremiumScore,
                  isCut: isCutScore
                })}`}>
                  {displayScore}
                </div>
              </div>
            </td>
          );
        })}
      </tr>

      {showBlockSummary ? (
        <tr className="summaryRow">
          <td colSpan={2}>
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

function getScoreBadgeClass(score, isInvalid, { isPremium = false, isCut = false } = {}) {
  if (isInvalid) {
    return 'scoreBadgeInvalid';
  }

  if (isPremium) {
    return 'scoreBadgePremium';
  }

  if (isCut) {
    return 'scoreBadgeCut';
  }

  if (score === null) {
    return 'scoreBadgeSoft';
  }

  if (score < 0) {
    return 'scoreBadgeNegative';
  }

  if (score > 0 && score < 100) {
    return 'scoreBadgeSoft';
  }

  return 'scoreBadgePositive';
}
