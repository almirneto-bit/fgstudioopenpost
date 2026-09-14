// ============================================================
// SM POST TEMPLATE — specs extraídas 1:1 do Figma
// Welcome World, page "Test_SM-Post"
// Modelos: Instagram post - 1, 7, 8 e 9
// ============================================================

export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1440;
export const SAFE_MARGIN = 88;
export const BRAND_ORANGE = '#EF7828';
export const BRAND_OFF_WHITE = '#FBF8F1';

export const FG_LOGO_COLORS = {
  white: '#EFEFEF',
  black: '#0C0C0F',
  orange: BRAND_ORANGE,
} as const;

export type FgLogoColor = keyof typeof FG_LOGO_COLORS;
export type SmPostMediaType = 'image' | 'video' | null;
export type SmPostTemplateId = '1' | '7' | '8' | '9';

const LOGO_FG_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/post/logo-fg.svg`;
const LOGO_SECONDARY_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/post/logo-secondary.svg`;

export const SM_POST_TEMPLATE = {
  canvas: { width: POST_WIDTH, height: POST_HEIGHT },
  image: { x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT, fit: 'cover' as const },
  shadow: {
    x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT,
    stops: [
      { offset: 0.1347, color: 'rgba(12, 12, 15, 0)' },
      { offset: 1, color: 'rgba(12, 12, 15, 1)' },
    ],
  },
  tag: {
    centerX: 539.5, y: 861, height: 45, paddingX: 24, paddingY: 8, cornerRadius: 24,
    background: '#DA291C', textColor: '#EFEFEF',
    fontFamily: '"Noto Sans", sans-serif', fontWeight: 700, fontSize: 24, letterSpacing: 0.48,
  },
  headline: {
    x: 179, y: 946, width: 721, height: 249,
    align: 'center' as const, color: '#FFFFFF',
    fontFamily: '"Vina Sans", sans-serif', fontWeight: 400, fontSize: 104, minFontSize: 48, lineHeight: 0.8,
  },
  bodyText: {
    x: 302, y: 1235, width: 475, height: 87,
    align: 'center' as const, color: '#EFEFEF',
    fontFamily: '"Noto Sans", sans-serif', fontWeight: 400, fontSize: 24, minFontSize: 14, lineHeight: 1.2, letterSpacing: 0.48,
  },
  logoFg: { x: 88, y: 88, width: 103.26, height: 64, src: LOGO_FG_SRC },
  logoSecondary: { x: 882, y: 99, width: 110, height: 42, src: LOGO_SECONDARY_SRC },
} as const;

export const SM_POST_VARIANTS = {
  '7': {
    background: BRAND_ORANGE,
    media: { x: 0, y: 430, width: 1080, height: 1010, radius: { tl: 44, tr: 44, br: 0, bl: 0 } },
    headline: { x: 87.5, y: 0, width: 905, height: 430, fontSize: 136, minFontSize: 72, lineHeight: 0.8, color: '#FFFFFF' },
    logoFg: { x: 88, y: 1289, width: 103.26, height: 64, src: LOGO_FG_SRC },
    logoSecondary: { x: 882, y: 1300, width: 110, height: 42, src: LOGO_SECONDARY_SRC },
  },
  '8': {
    background: BRAND_ORANGE,
    media: { x: 0, y: 0, width: 1080, height: 1010, radius: { tl: 0, tr: 0, br: 44, bl: 44 } },
    headline: { x: 87.5, y: 1010, width: 905, height: 430, fontSize: 136, minFontSize: 72, lineHeight: 0.8, color: '#FFFFFF' },
    logoFg: { x: 88, y: 88, width: 103.26, height: 64, src: LOGO_FG_SRC },
    logoSecondary: { x: 882, y: 99, width: 110, height: 42, src: LOGO_SECONDARY_SRC },
  },
  '9': {
    background: BRAND_ORANGE,
    media: { x: 0, y: 507, width: 1080, height: 933, radius: { tl: 0, tr: 0, br: 0, bl: 0 } },
    handle: {
      x: 0, y: 0, width: 1080, height: 140,
      fontFamily: '"Kanit", sans-serif', fontWeight: 400, fontSize: 40, minFontSize: 24, lineHeight: 0.8, color: BRAND_OFF_WHITE,
    },
    copyCard: { x: 0, y: 140, width: 1080, height: 443, radius: { tl: 0, tr: 0, br: 44, bl: 44 }, color: BRAND_OFF_WHITE },
    copy: {
      x: 92.5, y: 140, width: 895, height: 443,
      fontFamily: '"Kanit", sans-serif', fontWeight: 400, fontSize: 56, minFontSize: 28, lineHeight: 1.1, color: '#000000',
    },
    logoFg: { x: 88, y: 1289, width: 103.26, height: 64, src: LOGO_FG_SRC },
    logoSecondary: { x: 882, y: 1300, width: 110, height: 42, src: LOGO_SECONDARY_SRC },
  },
} as const;

export type SmPostFields = {
  templateId: SmPostTemplateId;
  imageUrl: string | null;
  mediaType: SmPostMediaType;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  logoFgColor: FgLogoColor;
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseSize: number;
  tag: string;
  tagUppercase: boolean;
  headline: string;
  headlineUppercase: boolean;
  headlineFontSize: number;
  tagHeadlineOffset: number;
  bodyText: string;
  bodyUppercase: boolean;
  bodyFontSize: number;
  headlineBodyOffset: number;
};

export const SM_POST_DEFAULTS: SmPostFields = {
  templateId: '1',
  imageUrl: null,
  mediaType: null,
  imageScale: 1,
  imageOffsetX: 0,
  imageOffsetY: 0,
  logoFgColor: 'white',
  noiseEnabled: false,
  noiseIntensity: 35,
  noiseSize: 4,
  tag: 'COMPETITIVO',
  tagUppercase: false,
  headline: 'a favela tá pronta pra entrar na arena!',
  headlineUppercase: false,
  headlineFontSize: 104,
  tagHeadlineOffset: 0,
  bodyText: 'Monte a sua equipe, faça sua inscrição e tenha um pro de Clash Royale no comando do seu time!',
  bodyUppercase: false,
  bodyFontSize: 24,
  headlineBodyOffset: 0,
};

export const SM_POST_TEMPLATE_PRESETS: Record<SmPostTemplateId, Partial<SmPostFields>> = {
  '1': {
    tag: 'COMPETITIVO', tagUppercase: false,
    headline: 'a favela tá pronta pra entrar na arena!', headlineUppercase: false, headlineFontSize: 104,
    bodyText: 'Monte a sua equipe, faça sua inscrição e tenha um pro de Clash Royale no comando do seu time!', bodyUppercase: false, bodyFontSize: 24,
    tagHeadlineOffset: 0, headlineBodyOffset: 0,
  },
  '7': {
    tag: '', tagUppercase: false,
    headline: 'a favela tá pronta pra entrar!', headlineUppercase: true, headlineFontSize: 136,
    bodyText: '', bodyUppercase: false, bodyFontSize: 24,
    tagHeadlineOffset: 0, headlineBodyOffset: 0,
  },
  '8': {
    tag: '', tagUppercase: false,
    headline: 'a favela tá pronta pra entrar!', headlineUppercase: true, headlineFontSize: 136,
    bodyText: '', bodyUppercase: false, bodyFontSize: 24,
    tagHeadlineOffset: 0, headlineBodyOffset: 0,
  },
  '9': {
    tag: '@favelaGamingOFC', tagUppercase: true,
    headline: '', headlineUppercase: false, headlineFontSize: 104,
    bodyText: 'Nas periferias, o game também é espaço de expressão, conexão e oportunidade.', bodyUppercase: true, bodyFontSize: 56,
    tagHeadlineOffset: 0, headlineBodyOffset: 0,
  },
};
