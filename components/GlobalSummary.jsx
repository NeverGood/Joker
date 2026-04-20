'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PLAYERS, PLAYER_KEYS } from '../lib/game-config';
import ScoreboardShell from './ScoreboardShell';

export default function GlobalSummary() {
  const [savedGames, setSavedGames] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingGameId, setSavingGameId] = useState('');
  const [editingGameId, setEditingGameId] = useState('');
  const [savingArchiveGame, setSavingArchiveGame] = useState(false);
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  const [archiveForm, setArchiveForm] = useState(() => createArchiveGameForm());
  const [leaderboardSort, setLeaderboardSort] = useState({
    key: 'totalWinPoints',
    direction: 'desc'
  });

  useEffect(() => {
    loadGames();
    loadCurrentUser();
  }, []);

  const isAdmin = Boolean(currentUser?.isAdmin);

  useEffect(() => {
    if (!isAdmin) {
      setRegisteredUsers([]);
      setShowArchiveForm(false);
      return;
    }

    loadRegisteredUsers();
  }, [isAdmin]);

  async function loadGames() {
    try {
      setLoading(true);
      const response = await fetch('/api/games', { cache: 'no-store' });
      const data = await response.json();
      setSavedGames(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load summary', error);
      setSavedGames([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentUser() {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await response.json();
      setCurrentUser(data?.user || null);
    } catch {
      setCurrentUser(null);
    }
  }

  async function loadRegisteredUsers() {
    try {
      const response = await fetch('/api/users', { cache: 'no-store' });
      const data = await response.json();
      const users = Array.isArray(data) ? data : [];

      setRegisteredUsers(users);
      setArchiveForm((currentForm) => createArchiveGameForm(users, currentForm));
    } catch {
      setRegisteredUsers([]);
    }
  }

  const leaderboard = useMemo(() => buildLeaderboard(savedGames), [savedGames]);

  const sortedLeaderboard = useMemo(
    () => sortLeaderboard(leaderboard, leaderboardSort),
    [leaderboard, leaderboardSort]
  );

  function updateSavedGameTotal(gameId, playerKey, value) {
    setSavedGames((prev) =>
      prev.map((game) =>
        game.id === gameId
          ? {
              ...game,
              totals: {
                ...game.totals,
                [playerKey]: value
              }
            }
          : game
      )
    );
  }

  async function saveGameTotals(game) {
    try {
      setSavingGameId(game.id);
      const response = await fetch(`/api/games/${game.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          totals: game.totals
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update game');
      }

      setSavedGames((prev) =>
        prev.map((savedGame) =>
          savedGame.id === game.id
            ? {
                ...savedGame,
                totals: data.totals
              }
            : savedGame
        )
      );
      setEditingGameId('');
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Не удалось обновить партию.');
    } finally {
      setSavingGameId('');
    }
  }

  async function deleteSavedGame(gameId) {
    if (!window.confirm('Удалить сохраненную игру?')) {
      return;
    }

    try {
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete game');
      }

      setSavedGames((prev) => prev.filter((game) => game.id !== gameId));
      setEditingGameId((currentGameId) => (currentGameId === gameId ? '' : currentGameId));
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Не удалось удалить партию.');
    }
  }

  function updateLeaderboardSort(sortKey) {
    setLeaderboardSort((currentSort) => {
      if (currentSort.key === sortKey) {
        return {
          key: sortKey,
          direction: currentSort.direction === 'asc' ? 'desc' : 'asc'
        };
      }

      return {
        key: sortKey,
        direction: sortKey === 'name' ? 'asc' : 'desc'
      };
    });
  }

  function handleEditAction(game) {
    if (editingGameId === game.id) {
      saveGameTotals(game);
      return;
    }

    setEditingGameId(game.id);
  }

  function updateArchiveFormField(field, value) {
    setArchiveForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function updateArchivePlayer(playerKey, value) {
    setArchiveForm((currentForm) => ({
      ...currentForm,
      players: {
        ...currentForm.players,
        [playerKey]: value
      }
    }));
  }

  function updateArchiveTotal(playerKey, value) {
    setArchiveForm((currentForm) => ({
      ...currentForm,
      totals: {
        ...currentForm.totals,
        [playerKey]: value
      }
    }));
  }

  async function createArchiveGame(event) {
    event.preventDefault();

    const selectedPlayers = PLAYER_KEYS.map((playerKey) => archiveForm.players[playerKey]).filter(Boolean);
    const uniquePlayers = new Set(selectedPlayers);

    if (selectedPlayers.length !== PLAYER_KEYS.length || uniquePlayers.size !== PLAYER_KEYS.length) {
      window.alert('Выбери четырех разных игроков из списка учетных записей.');
      return;
    }

    const selectedDate = new Date(archiveForm.createdAt);

    if (Number.isNaN(selectedDate.getTime())) {
      window.alert('Укажи корректную дату игры.');
      return;
    }

    try {
      setSavingArchiveGame(true);
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          manualArchive: true,
          title: archiveForm.title.trim() || `Партия ${savedGames.length + 1}`,
          createdAt: selectedDate.toISOString(),
          players: archiveForm.players,
          totals: archiveForm.totals,
          rounds: {}
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create archive game');
      }

      setSavedGames((prev) =>
        [data, ...prev].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      );
      setArchiveForm(createArchiveGameForm(registeredUsers));
      setShowArchiveForm(false);
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Не удалось добавить игру в архив.');
    } finally {
      setSavingArchiveGame(false);
    }
  }

  return (
    <ScoreboardShell
      eyebrow="Casino hall overview"
      title="Общий счет всех игр"
      description="Здесь живет сводная таблица по всем сохраненным партиям: кто выигрывал чаще, кто набрал больше очков и как выглядела история игр за весь вечер. Данные уже читаются из SQLite через Prisma."
      active="summary"
      actions={
        <div className="heroStatsRow">
          <div className="heroStatCard">
            <span className="heroStatValue">{savedGames.length}</span>
            <span className="heroStatLabel">сохраненных партий</span>
          </div>
          <div className="heroStatCard">
            <span className="heroStatValue">{sortedLeaderboard[0]?.totalWinPoints ?? 0}</span>
            <span className="heroStatLabel">лучший рейтинг в баллах</span>
          </div>
        </div>
      }
    >
      <section className="panelGrid panelGridTop leaderboardSection">
        <div className="panelCard panelCardWide leaderboardPanel">
          <div className="panelHeader">
            <div>
              <p className="sectionEyebrow">Leaderboard</p>
              <h2 className="sectionTitle">Общий рейтинг игроков</h2>
            </div>
          </div>
          <div className="leaderboardTableWrap">
            <table className="scoreTable compactTable leaderboardTable">
              <thead>
                <tr>
                  <th>
                    <SortableHeader
                      label="Игрок"
                      sortKey="name"
                      activeSort={leaderboardSort}
                      onSort={updateLeaderboardSort}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Всего игр"
                      sortKey="gamesPlayed"
                      activeSort={leaderboardSort}
                      onSort={updateLeaderboardSort}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Всего очков"
                      sortKey="totalScore"
                      activeSort={leaderboardSort}
                      onSort={updateLeaderboardSort}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Среднее очков"
                      sortKey="averageScore"
                      activeSort={leaderboardSort}
                      onSort={updateLeaderboardSort}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Всего баллов"
                      sortKey="totalWinPoints"
                      activeSort={leaderboardSort}
                      onSort={updateLeaderboardSort}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      label="Среднее кол-во баллов"
                      sortKey="averageWinPoints"
                      activeSort={leaderboardSort}
                      onSort={updateLeaderboardSort}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="emptyState">
                        Рейтинг появится после первой сохраненной партии.
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedLeaderboard.map((entry) => (
                    <tr key={entry.name}>
                      <td className="playerNameCell">{entry.name}</td>
                      <td className="numericCell">{entry.gamesPlayed}</td>
                      <td className="numericCell">{entry.totalScore}</td>
                      <td className="numericCell">{formatAverage(entry.averageScore)}</td>
                      <td className="numericCell">{entry.totalWinPoints}</td>
                      <td className="numericCell">{formatAverage(entry.averageWinPoints)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="archivePanel" id="history">
        <div className="panelHeader">
          <div>
            <p className="sectionEyebrow">History</p>
            <h2 className="sectionTitle">Все сохраненные игры</h2>
          </div>
          {isAdmin ? (
            <button
              type="button"
              className="secondaryButton archiveToggleButton"
              onClick={() => setShowArchiveForm((isShown) => !isShown)}
            >
              {showArchiveForm ? 'Скрыть форму' : 'Добавить игру в архив'}
            </button>
          ) : null}
        </div>
        {isAdmin && showArchiveForm ? (
          <form className="archiveGameForm" onSubmit={createArchiveGame}>
            <div className="archiveGameMetaGrid">
              <label className="titleField">
                <span className="fieldLabel">Название партии</span>
                <input
                  className="textField"
                  value={archiveForm.title}
                  onChange={(event) => updateArchiveFormField('title', event.target.value)}
                  placeholder={`Партия ${savedGames.length + 1}`}
                />
              </label>
              <label className="titleField">
                <span className="fieldLabel">Дата игры</span>
                <input
                  className="textField"
                  type="datetime-local"
                  value={archiveForm.createdAt}
                  onChange={(event) => updateArchiveFormField('createdAt', event.target.value)}
                />
              </label>
            </div>
            <div className="archivePlayersGrid">
              {PLAYER_KEYS.map((playerKey, index) => (
                <div className="archivePlayerCard" key={playerKey}>
                  <label className="titleField">
                    <span className="fieldLabel">Игрок {index + 1}</span>
                    <select
                      className="textField"
                      value={archiveForm.players[playerKey]}
                      onChange={(event) => updateArchivePlayer(playerKey, event.target.value)}
                    >
                      <option value="">Выбери игрока</option>
                      {registeredUsers.map((user) => (
                        <option key={`${playerKey}-${user.id}`} value={user.username}>
                          {user.username}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="titleField">
                    <span className="fieldLabel">Очки</span>
                    <input
                      className="textField"
                      type="number"
                      value={archiveForm.totals[playerKey]}
                      onChange={(event) => updateArchiveTotal(playerKey, event.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="archiveFormActions">
              <button type="submit" className="primaryButton" disabled={savingArchiveGame}>
                {savingArchiveGame ? 'Добавляем...' : 'Добавить в архив'}
              </button>
              <button type="button" className="ghostButton" onClick={() => setShowArchiveForm(false)}>
                Отмена
              </button>
            </div>
          </form>
        ) : null}
        {loading ? (
          <div className="emptyState">Загружаем партии из SQLite...</div>
        ) : savedGames.length === 0 ? (
          <div className="emptyState">
            Архив пока пуст. Сохрани первую партию на главной странице, и общий счет появится здесь автоматически.
          </div>
        ) : (
          <div className="historyTableWrap">
            <table className="scoreTable compactTable">
              <thead>
                <tr>
                  <th>Партия</th>
                  <th>Дата</th>
                  {PLAYER_KEYS.map((playerKey, index) => (
                    <th key={playerKey}>Игрок {index + 1}</th>
                  ))}
                  {isAdmin ? <th>Админ</th> : null}
                </tr>
              </thead>
              <tbody>
                {savedGames.map((game) => {
                  const isEditing = editingGameId === game.id;
                  const isSaving = savingGameId === game.id;

                  return (
                    <tr key={game.id}>
                      <td>{game.title}</td>
                      <td>{new Date(game.createdAt).toLocaleString('ru-RU')}</td>
                      {PLAYER_KEYS.map((playerKey) => (
                        <td key={`${game.id}-${playerKey}`}>
                          <div className="historyPlayerCell">
                            <span className="historyPlayerName">{getPlayerName(game, playerKey)}</span>
                            {isAdmin && isEditing ? (
                              <input
                                className="adminScoreInput"
                                type="number"
                                value={game.totals[playerKey]}
                                onChange={(event) => updateSavedGameTotal(game.id, playerKey, event.target.value)}
                              />
                            ) : (
                              <strong className="historyScoreValue">{game.totals[playerKey]}</strong>
                            )}
                          </div>
                        </td>
                      ))}
                      {isAdmin ? (
                        <td>
                          <div className="adminActions">
                            <button
                              type="button"
                              className={`iconActionButton ${isEditing ? 'iconActionButtonActive' : ''}`}
                              onClick={() => handleEditAction(game)}
                              disabled={isSaving}
                              aria-label={isEditing ? 'Сохранить изменения' : 'Редактировать счет партии'}
                              title={isEditing ? 'Сохранить' : 'Редактировать'}
                            >
                              {isEditing ? <CheckIcon /> : <PencilIcon />}
                            </button>
                            <button
                              type="button"
                              className="iconActionButton iconActionButtonDanger"
                              onClick={() => deleteSavedGame(game.id)}
                              aria-label="Удалить сохраненную игру"
                              title="Удалить"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ScoreboardShell>
  );
}

function buildLeaderboard(games) {
  const statsByName = new Map();

  games.forEach((game) => {
    const gameEntries = PLAYER_KEYS.map((playerKey) => ({
      name: getPlayerName(game, playerKey),
      score: cleanNumber(game?.totals?.[playerKey])
    }));

    [...gameEntries]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.name.localeCompare(right.name, 'ru');
      })
      .forEach((entry, index) => {
        const currentStats = statsByName.get(entry.name) || {
          name: entry.name,
          gamesPlayed: 0,
          totalScore: 0,
          totalWinPoints: 0
        };

        currentStats.gamesPlayed += 1;
        currentStats.totalScore += entry.score;
        currentStats.totalWinPoints += Math.max(0, 3 - index);
        statsByName.set(entry.name, currentStats);
      });
  });

  return Array.from(statsByName.values()).map((entry) => ({
    ...entry,
    averageScore: entry.gamesPlayed > 0 ? entry.totalScore / entry.gamesPlayed : 0,
    averageWinPoints: entry.gamesPlayed > 0 ? entry.totalWinPoints / entry.gamesPlayed : 0
  }));
}

function createArchiveGameForm(users = [], currentForm = null) {
  const userNames = users.map((user) => user.username).filter(Boolean);
  const fallbackPlayers = Object.fromEntries(
    PLAYER_KEYS.map((playerKey, index) => [playerKey, userNames[index] || currentForm?.players?.[playerKey] || ''])
  );

  return {
    title: currentForm?.title || '',
    createdAt: currentForm?.createdAt || formatDateTimeLocal(new Date()),
    players: fallbackPlayers,
    totals: Object.fromEntries(
      PLAYER_KEYS.map((playerKey) => [playerKey, currentForm?.totals?.[playerKey] ?? '0'])
    )
  };
}

function formatDateTimeLocal(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function sortLeaderboard(leaderboard, sort) {
  const directionMultiplier = sort.direction === 'asc' ? 1 : -1;

  return [...leaderboard].sort((left, right) => {
    const leftValue = left[sort.key];
    const rightValue = right[sort.key];

    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      const result = String(leftValue).localeCompare(String(rightValue), 'ru');
      return result * directionMultiplier;
    }

    if (leftValue !== rightValue) {
      return (leftValue - rightValue) * directionMultiplier;
    }

    if (left.totalWinPoints !== right.totalWinPoints) {
      return right.totalWinPoints - left.totalWinPoints;
    }

    if (left.totalScore !== right.totalScore) {
      return right.totalScore - left.totalScore;
    }

    return left.name.localeCompare(right.name, 'ru');
  });
}

function SortableHeader({ label, sortKey, activeSort, onSort }) {
  const isActive = activeSort.key === sortKey;

  return (
    <button
      type="button"
      className={`sortableHeader ${isActive ? 'sortableHeaderActive' : ''}`}
      onClick={() => onSort(sortKey)}
      aria-label={`Сортировать по колонке ${label}`}
    >
      <span>{label}</span>
      <span className="sortIndicator">{isActive ? (activeSort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  );
}

function PencilIcon() {
  return (
    <svg className="iconActionSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4.7L19.4 9.3a2 2 0 0 0 0-2.8l-1.9-1.9a2 2 0 0 0-2.8 0L4 15.3V20Z" />
      <path d="m13.7 5.6 4.7 4.7" />
      <path d="M4 20h16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="iconActionSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 6.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="iconActionSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7 8 20h8l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function getPlayerName(game, playerKey) {
  return String(game?.players?.[playerKey] || DEFAULT_PLAYERS[playerKey]).trim();
}

function cleanNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatAverage(value) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1
  }).format(value);
}
