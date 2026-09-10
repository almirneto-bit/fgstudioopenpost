import type { Metadata } from 'next';
import './post.css';

export const metadata: Metadata = {
  title: 'Post',
};

// Vina Sans (headline) e Noto Sans (body/tag) — fontes usadas no layout do
// Figma. Carregadas via <link> (em vez de next/font) porque o canvas 2D
// precisa que document.fonts esteja populado com esses family names,
// que é o comportamento padrão do link do Google Fonts.
export default function PostLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Vina+Sans&family=Noto+Sans:wght@400;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
