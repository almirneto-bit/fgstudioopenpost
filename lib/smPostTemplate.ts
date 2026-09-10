// ============================================================
// SM POST TEMPLATE — specs extraídas 1:1 do Figma
// (Welcome World, page "Test_SM-Post", frame "Instagram post - 1",
//  node 271:2)
//
// Este é o ÚNICO layout do sistema: 4 slots editáveis (image, tag,
// headline, bodyText) + 3 elementos fixos (logoFg, logoSecondary,
// shadow). Ao contrário de templates/*.ts (que descrevem uma
// transformação POR FRAME para a engine de animação), este é um
// layout estático — um objeto de constantes que o SmPostCanvas usa
// para desenhar uma vez.
// ============================================================

export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1440;

export const SM_POST_TEMPLATE = {
  canvas: { width: POST_WIDTH, height: POST_HEIGHT },

  // ---- Editável: imagem de fundo (Rectangle 1) ----
  image: {
    x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT,
    // O Figma usa STRETCH; aqui usamos "cover" para aceitar qualquer
    // foto enviada pelo usuário sem distorcer.
    fit: 'cover' as const,
  },

  // ---- Fixo: overlay de sombra (Rectangle 3) ----
  shadow: {
    x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT,
    // Gradiente linear de cima para baixo: escuro opaco no topo,
    // transparente a partir de ~86.5% da altura.
    stops: [
      { offset: 0, color: 'rgba(12, 12, 15, 1)' },
      { offset: 0.8653, color: 'rgba(12, 12, 15, 0)' },
    ],
  },

  // ---- Editável: tag/pill (Frame 1) ----
  tag: {
    // Caixa auto-hug: a largura real é calculada em runtime a partir
    // do texto; center é o ponto de referência horizontal do pill.
    centerX: POST_WIDTH / 2 + 5, // (430+649)/2 ≈ 539.5 sobre 1080 → quase centro
    y: 861,
    height: 45,
    paddingX: 24,
    paddingY: 8,
    cornerRadius: 24,
    background: '#DA291C',
    textColor: '#EFEFEF',
    fontFamily: '"Noto Sans", sans-serif',
    fontWeight: 700,
    fontSize: 24,
    letterSpacing: 0.48,
  },

  // ---- Editável: headline (271:12) ----
  headline: {
    x: 179, y: 946, width: 721, height: 249,
    align: 'center' as const,
    color: '#FFFFFF',
    fontFamily: '"Vina Sans", sans-serif',
    fontWeight: 400,
    fontSize: 104,
    lineHeight: 0.8, // 83.2px @ 104px = 80%
    uppercase: true,
  },

  // ---- Editável: body text (271:25) ----
  bodyText: {
    x: 302, y: 1235, width: 475, height: 87,
    align: 'center' as const,
    color: '#EFEFEF',
    fontFamily: '"Noto Sans", sans-serif',
    fontWeight: 400,
    fontSize: 24,
    lineHeight: 1.2, // 28.8px @ 24px = 120%
    letterSpacing: 0.48,
  },

  // ---- Fixo: logo principal FG (271:9, [FG] Logo / White) ----
  logoFg: {
    x: 88, y: 88, width: 103.26, height: 64,
    src: '/post/logo-fg.svg',
  },

  // ---- Fixo: logotipo secundário/parceiro (271:56, Group 1) ----
  logoSecondary: {
    x: 882, y: 99, width: 110, height: 42,
    src: '/post/logo-secondary.svg',
  },
} as const;

export type SmPostFields = {
  imageUrl: string | null;
  tag: string;
  headline: string;
  bodyText: string;
};

export const SM_POST_DEFAULTS: SmPostFields = {
  imageUrl: null,
  tag: 'COMPETITIVO',
  headline: 'a favela tá pronta pra entrar na arena!',
  bodyText:
    'Monte a sua equipe, faça sua inscrição e tenha um pro de Clash Royale no comando do seu time!',
};
