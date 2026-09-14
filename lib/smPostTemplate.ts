// ============================================================
// SM POST TEMPLATES — specs extraídas da page "Test_SM-Post"
// do arquivo Welcome World no Figma.
// ============================================================

export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1440;
export const SAFE_MARGIN = 88;

export type SmPostLayoutId =
  | 'classic'
  | 'kanit-left'
  | 'kanit-right'
  | 'kanit-center'
  | 'vina-left'
  | 'vina-right';

export type TextAlign = 'left' | 'center' | 'right';

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

export type SmPostTemplate = {
  id: SmPostLayoutId;
  figmaNodeId: string;
  name: string;
  shortName: string;
  headline: TextBox;
  bodyText: TextBox;
  tag?: TagBox;
};

const DEFAULT_BODY = {
  color: '#EFEFEF',
  fontFamily: '"Noto Sans", sans-serif',
  fontWeight: 400,
  fontSize: 24,
  minFontSize: 14,
  lineHeight: 1.2,
  letterSpacing: 0.48,
} as const;

export const SM_POST_LAYOUTS: Record<SmPostLayoutId, SmPostTemplate> = {
  classic: {
    id: 'classic',
    figmaNodeId: '271:2',
    name: 'Clássico com tag',
    shortName: 'Clássico',
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
    id: 'kanit-left', figmaNodeId: '277:3', name: 'Kanit à esquerda', shortName: 'Kanit E',
    headline: {
      x: 85, y: 755, width: 656, height: 414,
      align: 'left', color: '#FFFFFF', fontFamily: '"Kanit", sans-serif',
      fontWeight: 500, fontSize: 80, minFontSize: 38, lineHeight: 0.86,
    },
    bodyText: { x: 88, y: 1207, width: 689, height: 145, align: 'left', ...DEFAULT_BODY },
  },
  'kanit-right': {
    id: 'kanit-right', figmaNodeId: '277:52', name: 'Kanit à direita', shortName: 'Kanit D',
    headline: {
      x: 336, y: 755, width: 656, height: 414,
      align: 'right', color: '#FFFFFF', fontFamily: '"Kanit", sans-serif',
      fontWeight: 500, fontSize: 80, minFontSize: 38, lineHeight: 0.86,
    },
    bodyText: { x: 303, y: 1207, width: 689, height: 145, align: 'right', ...DEFAULT_BODY },
  },
  'kanit-center': {
    id: 'kanit-center', figmaNodeId: '277:84', name: 'Kanit central', shortName: 'Kanit C',
    headline: {
      x: 88, y: 936, width: 904, height: 248,
      align: 'center', color: '#FFFFFF', fontFamily: '"Kanit", sans-serif',
      fontWeight: 500, fontSize: 72, minFontSize: 36, lineHeight: 0.86,
    },
    bodyText: { x: 136, y: 1236, width: 808, height: 116, align: 'center', ...DEFAULT_BODY },
  },
  'vina-left': {
    id: 'vina-left', figmaNodeId: '277:116', name: 'Vina à esquerda', shortName: 'Vina E',
    headline: {
      x: 85, y: 666, width: 748, height: 512,
      align: 'left', color: '#FFFFFF', fontFamily: '"Vina Sans", sans-serif',
      fontWeight: 400, fontSize: 168, minFontSize: 56, lineHeight: 0.76,
    },
    bodyText: { x: 88, y: 1236, width: 808, height: 116, align: 'left', ...DEFAULT_BODY },
  },
  'vina-right': {
    id: 'vina-right', figmaNodeId: '277:155', name: 'Vina à direita', shortName: 'Vina D',
    headline: {
      x: 249, y: 666, width: 748, height: 512,
      align: 'right', color: '#FFFFFF', fontFamily: '"Vina Sans", sans-serif',
      fontWeight: 400, fontSize: 168, minFontSize: 56, lineHeight: 0.76,
    },
    bodyText: { x: 184, y: 1236, width: 808, height: 116, align: 'right', ...DEFAULT_BODY },
  },
};

export const SM_POST_LAYOUT_OPTIONS = Object.values(SM_POST_LAYOUTS);

export const SM_POST_SHARED = {
  image: { x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT },
  bottomShadow: [
    { offset: 0.1347, color: 'rgba(12, 12, 15, 0)' },
    { offset: 1, color: 'rgba(12, 12, 15, 1)' },
  ],
  topShadow: [
    { offset: 0, color: 'rgba(12, 12, 15, 1)' },
    { offset: 0.62, color: 'rgba(12, 12, 15, 0)' },
  ],
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
  layoutId: SmPostLayoutId;
  imageUrl: string | null;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  bottomShadowEnabled: boolean;
  topShadowEnabled: boolean;
  colorOverlayEnabled: boolean;
  colorOverlay: string;
  colorOverlayOpacity: number;
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseSize: number;
  tag: string;
  headline: string;
  headlineFontSize: number;
  tagHeadlineOffset: number;
  bodyText: string;
  bodyFontSize: number;
  headlineBodyOffset: number;
};

export function createDefaultFields(layoutId: SmPostLayoutId = 'classic'): SmPostFields {
  const layout = SM_POST_LAYOUTS[layoutId];
  const isClassic = layoutId === 'classic';
  return {
    layoutId,
    imageUrl: null,
    imageScale: 1,
    imageOffsetX: 0,
    imageOffsetY: 0,
    bottomShadowEnabled: true,
    topShadowEnabled: false,
    colorOverlayEnabled: true,
    colorOverlay: '#000000',
    colorOverlayOpacity: 5,
    noiseEnabled: false,
    noiseIntensity: 35,
    noiseSize: 4,
    tag: 'COMPETITIVO',
    headline: isClassic
      ? 'a favela tá pronta pra entrar na arena!'
      : layoutId.startsWith('vina')
        ? 'O jogo começa muito antes da partida.'
        : 'Nas periferias, o game também é espaço de expressão, conexão e oportunidade.',
    headlineFontSize: layout.headline.fontSize,
    tagHeadlineOffset: 0,
    bodyText: isClassic
      ? 'Monte a sua equipe, faça sua inscrição e tenha um pro de Clash Royale no comando do seu time!'
      : 'Os games se tornaram um espaço de encontro entre diferentes pessoas, histórias e referências. Um lugar onde competição e criatividade convivem e onde novas comunidades encontram liberdade para criar suas próprias formas de jogar e participar.',
    bodyFontSize: layout.bodyText.fontSize,
    headlineBodyOffset: 0,
  };
}

export const SM_POST_DEFAULTS = createDefaultFields();
