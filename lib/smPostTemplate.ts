// ============================================================
// SM POST TEMPLATE — specs extraídas 1:1 do Figma
// (Welcome World, page "Test_SM-Post", frame "Instagram post - 1",
//  node 271:2)
// ============================================================

export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1440;

export const SM_POST_TEMPLATE = {
  canvas: { width: POST_WIDTH, height: POST_HEIGHT },

  image: {
    x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT,
    fit: 'cover' as const,
  },

  shadow: {
    x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT,
    stops: [
      { offset: 0.1347, color: 'rgba(12, 12, 15, 0)' },
      { offset: 1, color: 'rgba(12, 12, 15, 1)' },
    ],
  },

  tag: {
    centerX: 539.5,
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

  headline: {
    x: 179, y: 946, width: 721, height: 249,
    align: 'center' as const,
    color: '#FFFFFF',
    fontFamily: '"Vina Sans", sans-serif',
    fontWeight: 400,
    fontSize: 104,
    minFontSize: 48,
    lineHeight: 0.8,
  },

  bodyText: {
    x: 302, y: 1235, width: 475, height: 87,
    align: 'center' as const,
    color: '#EFEFEF',
    fontFamily: '"Noto Sans", sans-serif',
    fontWeight: 400,
    fontSize: 24,
    minFontSize: 14,
    lineHeight: 1.2,
    letterSpacing: 0.48,
  },

  logoFg: {
    x: 88, y: 88, width: 103.26, height: 64,
    src: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/post/logo-fg.svg`,
  },

  logoSecondary: {
    x: 882, y: 99, width: 110, height: 42,
    src: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/post/logo-secondary.svg`,
  },
} as const;

export type SmPostFields = {
  imageUrl: string | null;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  tag: string;
  headline: string;
  headlineFontSize: number;
  bodyText: string;
  bodyFontSize: number;
};

export const SM_POST_DEFAULTS: SmPostFields = {
  imageUrl: null,
  imageScale: 1,
  imageOffsetX: 0,
  imageOffsetY: 0,
  tag: 'COMPETITIVO',
  headline: 'a favela tá pronta pra entrar na arena!',
  headlineFontSize: 104,
  bodyText:
    'Monte a sua equipe, faça sua inscrição e tenha um pro de Clash Royale no comando do seu time!',
  bodyFontSize: 24,
};
