import './globals.css';

export const metadata = {
  title: 'Joker Casino Scoreboard',
  description: 'Казино-таблица для ведения счета карточной игры на четверых.'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
