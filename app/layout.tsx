import type { Metadata } from 'next';
import '../styles/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'FG Post Studio',
  description: 'Editor de carrosséis FG — versão 04',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Kanit:wght@400;500&family=Vina+Sans&family=Noto+Sans:wght@400;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
