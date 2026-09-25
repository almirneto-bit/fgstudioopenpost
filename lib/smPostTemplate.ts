// ============================================================
// SM POST TEMPLATES
// Welcome World, page "Test_SM-Post"
// Base restaurada da manhã + Instagram post 7, 8 e 9.
// ============================================================

export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1440;
export const SAFE_MARGIN = 88;
export const BRAND_ORANGE = '#EF7828';
export const BRAND_RED = '#DA291C';
export const BRAND_CYAN = '#18D7F6';
export const BRAND_YELLOW = '#FCCF27';
export const BRAND_BLACK = '#0C0C0F';
export const BRAND_OFF_WHITE = '#FBF8F1';

export const SPECIAL_LAYOUT_COLORS = [
  { value: BRAND_ORANGE, label: 'Laranja' },
  { value: BRAND_RED, label: 'Vermelho' },
  { value: BRAND_CYAN, label: 'Ciano' },
  { value: BRAND_YELLOW, label: 'Amarelo' },
  { value: BRAND_BLACK, label: 'Preto' },
] as const;

export const FG_LOGO_COLORS = {
  white: '#EFEFEF',
  black: '#0C0C0F',
  orange: BRAND_ORANGE,
} as const;

export type FgLogoColor = keyof typeof FG_LOGO_COLORS;
export type SmPostMediaType = 'image' | 'video' | null;
export type TextAlign = 'left' | 'center' | 'right';

export type SmPostLayoutId =
  | 'classic'
  | 'kanit-left'
  | 'kanit-right'
  | 'kanit-center'
  | 'vina-left'
  | 'vina-right'
  | 'post-7'
  | 'post-8'
  | 'post-9';

type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  align: TextAlign;
  color: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  minFontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

type TagBox = {
  centerX: number;
  y: number;
  height: number;
  paddingX: number;
  cornerRadius: number;
  background: string;
  textColor: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
};

export type MediaBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: { tl: number; tr: number; br: number; bl: number };
};

type LogoBox = { x: number; y: number; width: number; height: number; src: string };

export type SmPostTemplate = {
  id: SmPostLayoutId;
  figmaNodeId: string;
  name: string;
  shortName: string;
  kind: 'standard' | 'post7' | 'post8' | 'post9';
  headline: TextBox;
  bodyText: TextBox;
  tag?: TagBox;
  handle?: TextBox;
  media?: MediaBox;
  background?: string;
  card?: { x: number; y: number; width: number; height: number; color: string; radius: { tl: number; tr: number; br: number; bl: number } };
  logoFg?: LogoBox;
  logoSecondary?: LogoBox;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const LOGO_FG_SRC = `${basePath}/post/logo-fg.svg`;
const LOGO_SECONDARY_SRC = `${basePath}/post/logo-secondary.svg`;

const DEFAULT_BODY = {
  color: '#EFEFEF',
  fontFamily: '"Noto Sans", sans-serif',
  fontWeight: 400,
  fontSize: 24,
  minFontSize: 14,
  lineHeight: 1.2,
  letterSpacing: 0.48,
} as const;

const EMPTY_BOX: TextBox = {
  x: 88, y: 88, width: 904, height: 1,
  align: 'center', color: '#FFFFFF',
  fontFamily: '"Noto Sans", sans-serif', fontWeight: 400,
  fontSize: 24, minFontSize: 14, lineHeight: 1.2,
};

export const SM_POST_SHARED = {
  image: { x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT } satisfies MediaBox,
  bottomShadow: [
    { offset: 0.1347, color: 'rgba(12, 12, 15, 0)' },
    { offset: 1, color: 'rgba(12, 12, 15, 1)' },
  ],
  topShadow: [
    { offset: 0, color: 'rgba(12, 12, 15, 1)' },
    { offset: 0.62, color: 'rgba(12, 12, 15, 0)' },
  ],
  logoFg: { x: 88, y: 88, width: 103.26, height: 64, src: LOGO_FG_SRC },
  logoSecondary: { x: 882, y: 99, width: 110, height: 42, src: LOGO_SECONDARY_SRC },
} as const;

export const SM_POST_LAYOUTS: Record<SmPostLayoutId, SmPostTemplate> = {
  classic: {
    id: 'classic',
    figmaNodeId: '271:2',
    name: 'Clássico com tag',
    shortName: 'Clássico',
    kind: 'standard',
    headline: {
      x: 179, y: 946, width: 721, height: 249,
      align: 'center', color: '#FFFFFF',
      fontFamily: '"Vina Sans", sans-serif', fontWeight: 400,
      fontSize: 104, minFontSize: 48, lineHeight: 0.8,
    },
    bodyText: {
      x: 302, y: 1235, width: 475, height: 87,
      align: 'center', ...DEFAULT_BODY,
    },
    tag: {
      centerX: 539.5, y: 861, height: 45, paddingX: 24,
      cornerRadius: 24, background: '#DA291C', textColor: '#EFEFEF',
      fontFamily: '"Noto Sans", sans-serif', fontWeight: 700,
      fontSize: 24, letterSpacing: 0.48,
    },
  },
  'kanit-left': {
    id: 'kanit-left', figmaNodeId: '277:3', name: 'Kanit à esquerda', shortName: 'Kanit E', kind: 'standard',
    headline: {
      x: 85, y: 755, width: 656, height: 414,
      align: 'left', color: '#FFFFFF', fontFamily: '"Kanit", sans-serif',
      fontWeight: 500, fontSize: 80, minFontSize: 38, lineHeight: 0.86,
    },
    bodyText: { x: 88, y: 1207, width: 689, height: 145, align: 'left', ...DEFAULT_BODY },
  },
  'kanit-right': {
    id: 'kanit-right', figmaNodeId: '277:52', name: 'Kanit à direita', shortName: 'Kanit D', kind: 'standard',
    headline: {
      x: 336, y: 755, width: 656, height: 414,
      align: 'right', color: '#FFFFFF', fontFamily: '"Kanit", sans-serif',
      fontWeight: 500, fontSize: 80, minFontSize: 38, lineHeight: 0.86,
    },
    bodyText: { x: 303, y: 1207, width: 689, height: 145, align: 'right', ...DEFAULT_BODY },
  },
  'kanit-center': {
    id: 'kanit-center', figmaNodeId: '277:84', name: 'Kanit central', shortName: 'Kanit C', kind: 'standard',
    headline: {
      x: 88, y: 936, width: 904, height: 248,
      align: 'center', color: '#FFFFFF', fontFamily: '"Kanit", sans-serif',
      fontWeight: 500, fontSize: 72, minFontSize: 36, lineHeight: 0.86,
    },
    bodyText: { x: 136, y: 1236, width: 808, height: 116, align: 'center', ...DEFAULT_BODY },
  },
  'vina-left': {
    id: 'vina-left', figmaNodeId: '277:116', name: 'Vina à esquerda', shortName: 'Vina E', kind: 'standard',
    headline: {
      x: 85, y: 666, width: 748, height: 512,
      align: 'left', color: '#FFFFFF', fontFamily: '"Vina Sans", sans-serif',
      fontWeight: 400, fontSize: 168, minFontSize: 56, lineHeight: 0.76,
    },
    bodyText: { x: 88, y: 1236, width: 808, height: 116, align: 'left', ...DEFAULT_BODY },
  },
  'vina-right': {
    id: 'vina-right', figmaNodeId: '277:155', name: 'Vina à direita', shortName: 'Vina D', kind: 'standard',
    headline: {
      x: 249, y: 666, width: 748, height: 512,
      align: 'right', color: '#FFFFFF', fontFamily: '"Vina Sans", sans-serif',
      fontWeight: 400, fontSize: 168, minFontSize: 56, lineHeight: 0.76,
    },
    bodyText: { x: 184, y: 1236, width: 808, height: 116, align: 'right', ...DEFAULT_BODY },
  },
  'post-7': {
    id: 'post-7', figmaNodeId: '285:12', name: 'Instagram post 7', shortName: 'Post 7', kind: 'post7',
    background: BRAND_ORANGE,
    media: { x: 0, y: 430, width: 1080, height: 1010, radius: { tl: 44, tr: 44, br: 0, bl: 0 } },
    headline: {
      x: 87.5, y: 0, width: 905, height: 430,
      align: 'center', color: '#FFFFFF', fontFamily: '"Vina Sans", sans-serif',
      fontWeight: 400, fontSize: 136, minFontSize: 72, lineHeight: 0.8,
    },
    bodyText: { ...EMPTY_BOX },
    logoFg: { x: 88, y: 1289, width: 103.26, height: 64, src: LOGO_FG_SRC },
    logoSecondary: { x: 882, y: 1300, width: 110, height: 42, src: LOGO_SECONDARY_SRC },
  },
  'post-8': {
    id: 'post-8', figmaNodeId: '285:50', name: 'Instagram post 8', shortName: 'Post 8', kind: 'post8',
    background: BRAND_ORANGE,
    media: { x: 0, y: 0, width: 1080, height: 1010, radius: { tl: 0, tr: 0, br: 44, bl: 44 } },
    headline: {
      x: 87.5, y: 1010, width: 905, height: 430,
      align: 'center', color: '#FFFFFF', fontFamily: '"Vina Sans", sans-serif',
      fontWeight: 400, fontSize: 136, minFontSize: 72, lineHeight: 0.8,
    },
    bodyText: { ...EMPTY_BOX },
    logoFg: { x: 88, y: 88, width: 103.26, height: 64, src: LOGO_FG_SRC },
    logoSecondary: { x: 882, y: 99, width: 110, height: 42, src: LOGO_SECONDARY_SRC },
  },
  'post-9': {
    id: 'post-9', figmaNodeId: '285:140', name: 'Instagram post 9', shortName: 'Post 9', kind: 'post9',
    background: BRAND_ORANGE,
    media: { x: 0, y: 507, width: 1080, height: 933 },
    headline: { ...EMPTY_BOX },
    handle: {
      x: 88, y: 0, width: 904, height: 140,
      align: 'center', color: BRAND_OFF_WHITE, fontFamily: '"Kanit", sans-serif',
      fontWeight: 400, fontSize: 40, minFontSize: 24, lineHeight: 0.9,
    },
    card: {
      x: 0, y: 140, width: 1080, height: 443, color: BRAND_OFF_WHITE,
      radius: { tl: 0, tr: 0, br: 44, bl: 44 },
    },
    bodyText: {
      x: 92.5, y: 140, width: 895, height: 443,
      align: 'center', color: '#000000', fontFamily: '"Kanit", sans-serif',
      fontWeight: 400, fontSize: 56, minFontSize: 28, lineHeight: 1.1,
    },
    logoFg: { x: 88, y: 1289, width: 103.26, height: 64, src: LOGO_FG_SRC },
    logoSecondary: { x: 882, y: 1300, width: 110, height: 42, src: LOGO_SECONDARY_SRC },
  },
};

export const SM_POST_LAYOUT_OPTIONS = Object.values(SM_POST_LAYOUTS);

export type SmPostFields = {
  layoutId: SmPostLayoutId;
  imageUrl: string | null;
  mediaType: SmPostMediaType;
  keepVideoAudio: boolean;
  videoTrimStart: number;
  videoTrimEnd: number | null;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  logoFgColor: FgLogoColor;
  layoutBackgroundColor: string;
  bottomShadowEnabled: boolean;
  topShadowEnabled: boolean;
  colorOverlayEnabled: boolean;
  colorOverlay: string;
  colorOverlayOpacity: number;
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseSize: number;
  tag: string;
  tagUppercase: boolean;
  headline: string;
  headlineUppercase: boolean;
  headlineFontSize: number;
  headlineLineHeight: number;
  tagHeadlineOffset: number;
  bodyText: string;
  bodyUppercase: boolean;
  bodyFontSize: number;
  bodyLineHeight: number;
  headlineBodyOffset: number;
};

export function createDefaultFields(layoutId: SmPostLayoutId = 'classic'): SmPostFields {
  const layout = SM_POST_LAYOUTS[layoutId];
  const special = layout.kind !== 'standard';
  const defaults: SmPostFields = {
    layoutId,
    imageUrl: null,
    mediaType: null,
    keepVideoAudio: false,
    videoTrimStart: 0,
    videoTrimEnd: null,
    imageScale: 1,
    imageOffsetX: 0,
    imageOffsetY: 0,
    logoFgColor: 'white',
    layoutBackgroundColor: layout.background ?? BRAND_ORANGE,
    bottomShadowEnabled: !special,
    topShadowEnabled: false,
    colorOverlayEnabled: !special,
    colorOverlay: '#000000',
    colorOverlayOpacity: 5,
    noiseEnabled: false,
    noiseIntensity: 35,
    noiseSize: 4,
    tag: 'COMPETITIVO',
    tagUppercase: false,
    headline: 'Nas periferias, o game também é espaço de expressão, conexão e oportunidade.',
    headlineUppercase: false,
    headlineFontSize: layout.headline.fontSize,
    headlineLineHeight: layout.headline.lineHeight,
    tagHeadlineOffset: 0,
    bodyText: 'Os games se tornaram um espaço de encontro entre diferentes pessoas, histórias e referências.',
    bodyUppercase: false,
    bodyFontSize: layout.bodyText.fontSize,
    bodyLineHeight: layout.bodyText.lineHeight,
    headlineBodyOffset: 0,
  };

  if (layoutId === 'classic') {
    defaults.headline = 'a favela tá pronta pra entrar na arena!';
    defaults.bodyText = 'Monte a sua equipe, faça sua inscrição e tenha um pro de Clash Royale no comando do seu time!';
  } else if (layoutId.startsWith('vina')) {
    defaults.headline = 'O jogo começa muito antes da partida.';
  } else if (layoutId === 'post-7' || layoutId === 'post-8') {
    defaults.tag = '';
    defaults.headline = 'a favela tá pronta pra entrar!';
    defaults.headlineUppercase = true;
    defaults.bodyText = '';
  } else if (layoutId === 'post-9') {
    defaults.tag = '@favelaGamingOFC';
    defaults.tagUppercase = false;
    defaults.headline = '';
    defaults.bodyText = 'Nas periferias, o game também é espaço de expressão, conexão e oportunidade.';
    defaults.bodyUppercase = true;
  }

  return defaults;
}

export const SM_POST_DEFAULTS = createDefaultFields();
