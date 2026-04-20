'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthNav() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await response.json();

        if (!ignore) {
          setUser(data?.user || null);
        }
      } catch {
        if (!ignore) {
          setUser(null);
        }
      }
    }

    loadUser();

    return () => {
      ignore = true;
    };
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST'
    });
    setUser(null);
    router.push('/summary');
    router.refresh();
  }

  if (!user) {
    return (
      <Link href="/login" className="navLink">
        Войти
      </Link>
    );
  }

  return (
    <button type="button" className="navLink navButton" onClick={logout}>
      Выйти: {user.username}
    </button>
  );
}
