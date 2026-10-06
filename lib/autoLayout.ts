import {
  POST_HEIGHT,
  POST_WIDTH,
  SAFE_MARGIN,
  SM_POST_LAYOUTS,
  type SmPostFields,
} from './smPostTemplate';

export type AutoLayoutProperty =
  | 'headlineFontSize'
  | 'headlineLineHeight'
  | 'bodyFontSize'
  | 'bodyLineHeight'
  | 'tagHeadlineOffset'
  | 'headlineBodyOffset'
  | 'imageScale'
  | 'imageOffsetX'
  | 'imageOffsetY';

export type AutoLayoutChange = {
  property: AutoLayoutProperty;
  value: number;
  reason?: string;
};

export type AutoLayoutProposal = {
  summary: string;
  changes: AutoLayoutChange[];
};

const ALLOWED_PROPERTIES: AutoLayoutProperty[] = [
  'headlineFontSize',
  'headlineLineHeight',
  'bodyFontSize',
  'bodyLineHeight',
  'tagHeadlineOffset',
  'headlineBodyOffset',
  'imageScale',
  'imageOffsetX',
  'imageOffsetY',
];

const LIMITS: Record<AutoLayoutProperty, { min: number; max: number; step?: number }> = {
  headlineFontSize: { min: 8, max: 250, step: 1 },
  headlineLineHeight: { min: 0.5, max: 2, step: 0.05 },
  bodyFontSize: { min: 8, max: 250, step: 1 },
  bodyLineHeight: { min: 0.5, max: 2, step: 0.05 },
  tagHeadlineOffset: { min: -180, max: 180, step: 2 },
  headlineBodyOffset: { min: -180, max: 180, step: 2 },
  imageScale: { min: 1, max: 2.5, step: 0.01 },
  imageOffsetX: { min: -800, max: 800, step: 1 },
  imageOffsetY: { min: -800, max: 800, step: 1 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number, step = 1) {
  return Math.round(value / step) * step;
}

export function sanitizeAutoLayoutChanges(input: unknown): AutoLayoutChange[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<AutoLayoutProperty>();
  const changes: AutoLayoutChange[] = [];

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as { property?: unknown; value?: unknown; reason?: unknown };
    if (typeof candidate.property !== 'string' || !ALLOWED_PROPERTIES.includes(candidate.property as AutoLayoutProperty)) continue;
    const property = candidate.property as AutoLayoutProperty;
    if (seen.has(property)) continue;
    const numericValue = Number(candidate.value);
    if (!Number.isFinite(numericValue)) continue;
    const limit = LIMITS[property];
    const value = snap(clamp(numericValue, limit.min, limit.max), limit.step);
    changes.push({
      property,
      value,
      ...(typeof candidate.reason === 'string' && candidate.reason.trim()
        ? { reason: candidate.reason.trim().slice(0, 180) }
        : {}),
    });
    seen.add(property);
  }

  return changes.slice(0, 9);
}

export function applyAutoLayoutChanges(fields: SmPostFields, input: unknown): SmPostFields {
  const changes = sanitizeAutoLayoutChanges(input);
  const next = { ...fields };
  for (const change of changes) {
    (next as unknown as Record<string, number>)[change.property] = change.value;
  }
  return next;
}

export function buildAutoLayoutState(fields: SmPostFields) {
  const layout = SM_POST_LAYOUTS[fields.layoutId];
  const headlineBox = {
    ...layout.headline,
    y: layout.headline.y + fields.tagHeadlineOffset,
  };
  const bodyBox = {
    ...layout.bodyText,
    y: layout.kind === 'standard'
      ? layout.bodyText.y + fields.tagHeadlineOffset + fields.headlineBodyOffset
      : layout.bodyText.y,
  };

  return {
    canvas: { width: POST_WIDTH, height: POST_HEIGHT, safeMargin: SAFE_MARGIN },
    layout: {
      id: layout.id,
      name: layout.name,
      kind: layout.kind,
      headlineBox,
      bodyBox,
      tag: layout.tag ?? null,
      handle: layout.handle ?? null,
      mediaBox: layout.media ?? { x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT },
      logoFg: layout.logoFg ?? null,
      logoSecondary: layout.logoSecondary ?? null,
    },
    content: {
      tag: fields.tag,
      headline: fields.headline,
      bodyText: fields.bodyText,
      hasMedia: Boolean(fields.imageUrl),
      mediaType: fields.mediaType,
    },
    current: {
      headlineFontSize: fields.headlineFontSize,
      headlineLineHeight: fields.headlineLineHeight,
      bodyFontSize: fields.bodyFontSize,
      bodyLineHeight: fields.bodyLineHeight,
      tagHeadlineOffset: fields.tagHeadlineOffset,
      headlineBodyOffset: fields.headlineBodyOffset,
      imageScale: fields.imageScale,
      imageOffsetX: fields.imageOffsetX,
      imageOffsetY: fields.imageOffsetY,
    },
    constraints: {
      immutable: ['text content', 'colors', 'logos', 'assets', 'layout id'],
      allowedProperties: ALLOWED_PROPERTIES,
      limits: LIMITS,
      goals: [
        'preserve brand consistency',
        'improve hierarchy and visual balance',
        'avoid crowded text blocks',
        'keep important content inside the safe area whenever the template allows it',
        'avoid unnecessary changes',
      ],
    },
  };
}
