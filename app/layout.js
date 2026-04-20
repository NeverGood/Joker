import './globals.css';

export const metadata = {
  title: 'Joker Casino Scoreboard',
  description: 'Казино-таблица для ведения счета карточной игры на четверых.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
