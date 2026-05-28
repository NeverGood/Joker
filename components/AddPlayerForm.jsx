'use client';

import { useState } from 'react';

export function mergePlayerList(players, player) {
  if (!player?.id || !player?.username) {
    return players;
  }

  const nextPlayers = players.some((currentPlayer) => currentPlayer.id === player.id)
    ? players.map((currentPlayer) => (currentPlayer.id === player.id ? player : currentPlayer))
    : [...players, player];

  return nextPlayers.sort((left, right) => left.username.localeCompare(right.username, 'ru'));
}

export default function AddPlayerForm({ className = '', onPlayerCreated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError('Укажи имя игрока и пароль.');
      setMessage('');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: cleanUsername,
          password
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось добавить игрока.');
      }

      onPlayerCreated?.(data);
      setUsername('');
      setPassword('');
      setMessage(`Игрок «${data.username}» добавлен.`);
    } catch (submitError) {
      setError(submitError.message || 'Не удалось добавить игрока.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`addPlayerForm ${className}`.trim()} onSubmit={handleSubmit}>
      <div className="addPlayerFormHeader">
        <p className="sectionEyebrow">Новый игрок</p>
      </div>
      <div className="addPlayerFormFields">
        <label className="titleField">
          <span className="fieldLabel">Имя игрока</span>
          <input
            className="textField"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Например, Ржавый"
            autoComplete="username"
          />
        </label>
        <label className="titleField">
          <span className="fieldLabel">Пароль</span>
          <input
            className="textField"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль для входа"
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="primaryButton addPlayerSubmitButton" disabled={saving}>
          {saving ? 'Добавляем...' : 'Добавить игрока'}
        </button>
      </div>
      {error ? <p className="formMessage formMessageError">{error}</p> : null}
      {message ? <p className="formMessage formMessageSuccess">{message}</p> : null}
    </form>
  );
}
