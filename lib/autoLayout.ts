import {
  POST_HEIGHT,
  POST_WIDTH,
  SAFE_MARGIN,
  SM_POST_LAYOUTS,
  type SmPostFields,
  type SmPostLayoutId,
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
  headlineBodyOffset: { min: -360, max: 180, step: 2 },
  imageScale: { min: 1, max: 2.5, step: 0.01 },
  imageOffsetX: { min: -800, max: 800, step: 1 },
  imageOffsetY: { min: -800, max: 800, step: 1 },
};

const TEMPLATE_READABILITY: Record<SmPostLayoutId, {
  bodyMin: number;
  headlineBodyOffset: { min: number; max: number } | null;
}> = {
  classic: { bodyMin: 30, headlineBodyOffset: { min: -120, max: 20 } },
  'kanit-left': { bodyMin: 30, headlineBodyOffset: { min: -170, max: 20 } },
  'kanit-center': { bodyMin: 30, headlineBodyOffset: { min: -140, max: 20 } },
  'kanit-right': { bodyMin: 30, headlineBodyOffset: { min: -170, max: 20 } },
  'vina-left': { bodyMin: 30, headlineBodyOffset: { min: -150, max: 10 } },
  'vina-right': { bodyMin: 30, headlineBodyOffset: { min: -150, max: 10 } },
  'post-7': { bodyMin: 14, headlineBodyOffset: null },
  'post-8': { bodyMin: 14, headlineBodyOffset: null },
  'post-9': { bodyMin: 32, headlineBodyOffset: null },
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
    changes.push({
      property,
      value: snap(clamp(numericValue, limit.min, limit.max), limit.step),
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

  const layout = SM_POST_LAYOUTS[next.layoutId];
  const profile = TEMPLATE_READABILITY[next.layoutId];
  if (next.bodyText.trim()) {
    next.bodyFontSize = Math.max(profile.bodyMin, next.bodyFontSize);
    next.bodyLineHeight = Math.max(1.05, next.bodyLineHeight);
  }
  if (layout.kind === 'standard' && profile.headlineBodyOffset) {
    next.headlineBodyOffset = clamp(
      next.headlineBodyOffset,
      profile.headlineBodyOffset.min,
      profile.headlineBodyOffset.max,
    );
  }
  return next;
}

export function buildAutoLayoutState(fields: SmPostFields) {
  const layout = SM_POST_LAYOUTS[fields.layoutId];
  const profile = TEMPLATE_READABILITY[fields.layoutId];

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
    mode: 'readability',
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
      limits: {
        ...LIMITS,
        bodyFontSize: { ...LIMITS.bodyFontSize, min: profile.bodyMin },
        ...(profile.headlineBodyOffset
          ? { headlineBodyOffset: { ...LIMITS.headlineBodyOffset, ...profile.headlineBodyOffset } }
          : {}),
      },
      principles: [
        'prioritize readability above visual impact',
        'headline should lead without making body copy look secondary or tiny',
        'headline and body should feel visually connected',
        'preserve the original alignment and structure of the selected template',
        'keep important text and logos inside the safe area',
        'prefer fewer meaningful changes instead of redesigning the template',
      ],
    },
  };
}
