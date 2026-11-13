import icons from '../branding/final-level/fl-icons.json';

// Fonte oficial: pacote fl-icons.json fornecido pelo time criativo.
// Apenas os elementos SVG estáticos do asset versionado são renderizados.
// A seleção dos nomes é controlada pelo código, nunca por entrada HTML dos usuários.
export type FlIconName = keyof typeof icons;
export function FlIcon({ name, size = 20, strokeWidth = 1.7, className = '' }: {
  name: FlIconName; size?: number; strokeWidth?: number; className?: string;
}) {
  const entry = icons[name];
  if (!entry) return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: entry.g }} />
  );
}
