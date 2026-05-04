import './globals.css';
import PageMetadataClient from '../components/PageMetadataClient';

export const metadata = {
  title: 'Joker Bus-Angeles Edition',
  description: 'Казино-таблица для ведения счета карточной игры на четверых.',
  icons: {
    icon: '/joker-favicon.svg?v=2',
    shortcut: '/joker-favicon.svg?v=2',
    apple: '/joker-favicon.svg?v=2'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <PageMetadataClient />
        {children}
      </body>
    </html>
  );
}
