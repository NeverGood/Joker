'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || 'Не удалось войти.');
        return;
      }

      router.push('/');
      router.refresh();
    } catch (loginError) {
      console.error(loginError);
      setError('Не удалось войти.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="loginCard" onSubmit={handleSubmit}>
      <div>
        <p className="sectionEyebrow">Player access</p>
        <h1 className="sectionTitle">Вход в игру</h1>
      </div>

      <label className="loginField">
        <span className="fieldLabel">Игрок</span>
        <input
          className="textField"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          placeholder="Например, Бутка"
        />
      </label>

      <label className="loginField">
        <span className="fieldLabel">Пароль</span>
        <input
          className="textField"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Пароль"
        />
      </label>

      {error ? <div className="warningBox">{error}</div> : null}

      <button className="primaryButton" type="submit" disabled={loading}>
        {loading ? 'Входим...' : 'Войти'}
      </button>
    </form>
  );
}
