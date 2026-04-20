import Link from 'next/link';
import AuthNav from './AuthNav';

export default function ScoreboardShell({
  active = 'game',
  children
}) {
  return (
    <main className="pageShell">
      <div className="ambientGlow ambientGlowLeft" />
      <div className="ambientGlow ambientGlowRight" />
      <section className="casinoFrame">
        <header className="topBar">
          <Link href="/" className="brandMark">
            Joker Bus-Angeles Edition
          </Link>
          <nav className="topNav">
            <Link href="/" className={active === 'game' ? 'navLink navLinkActive' : 'navLink'}>
              Игра
            </Link>
            <Link
              href="/summary"
              className={active === 'summary' ? 'navLink navLinkActive' : 'navLink'}
            >
              Общий счет
            </Link>
            <AuthNav />
          </nav>
        </header>

        {children}
      </section>
    </main>
  );
}
