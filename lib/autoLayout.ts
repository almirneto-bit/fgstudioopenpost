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

export type AutoLayoutMode = 'balanced' | 'readability' | 'headline';

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
  headlineBodyOffset: { min: -360, max: 180, step: 2 },
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

export function applyAutoLayoutChanges(
  fields: SmPostFields,
  input: unknown,
  mode: AutoLayoutMode = 'balanced',
): SmPostFields {
  const changes = sanitizeAutoLayoutChanges(input);
  const next = { ...fields };
  for (const change of changes) {
    (next as unknown as Record<string, number>)[change.property] = change.value;
  }

  const layout = SM_POST_LAYOUTS[next.layoutId];
  if (layout.kind === 'standard' && next.bodyText.trim()) {
    const minBody = mode === 'readability' ? 30 : 26;
    next.bodyFontSize = Math.max(minBody, next.bodyFontSize);
    next.bodyLineHeight = Math.max(mode === 'readability' ? 1.05 : 0.95, next.bodyLineHeight);
    next.headlineBodyOffset = clamp(next.headlineBodyOffset, -360, 100);
  }

  return next;
}

export function buildAutoLayoutState(fields: SmPostFields, mode: AutoLayoutMode = 'balanced') {
  const layout = SM_POST_LAYOUTS[fields.layoutId];
  const bodyMinimum = layout.kind === 'standard' ? Math.max(26, layout.bodyText.minFontSize) : layout.bodyText.minFontSize;
  const layoutProfile = {
    textGrouping: layout.kind === 'standard' ? 'headline and body must read as one visual group' : 'preserve the template text structure',
    alignment: layout.headline.align,
    headlinePreferredMin: Math.max(layout.headline.minFontSize, Math.round(layout.headline.fontSize * 0.72)),
    headlinePreferredMax: Math.min(250, Math.round(layout.headline.fontSize * 1.18)),
    bodyPreferredMin: bodyMinimum,
    bodyPreferredMax: layout.kind === 'standard' ? Math.max(34, Math.round(layout.bodyText.fontSize * 1.55)) : Math.max(bodyMinimum, layout.bodyText.fontSize * 1.35),
    headlineBodyOffsetPreferred: layout.kind === 'standard' ? { min: -180, max: 40 } : null,
  };
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
    mode,
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
        bodyFontSize: { ...LIMITS.bodyFontSize, min: bodyMinimum },
      },
      layoutProfile,
      principles: [
        'proximity: related text elements should feel grouped',
        'alignment: preserve the template alignment axis',
        'hierarchy: headline leads, body remains clearly readable',
        'safe area: important text and logos should remain protected from canvas edges',
        'negative space: preserve breathing room without visually disconnecting related content',
      ],
      modeGuidance: mode === 'readability'
        ? ['prioritize body readability', 'reduce excessive headline dominance', 'bring headline and body closer when disconnected']
        : mode === 'headline'
          ? ['keep headline visually dominant', 'preserve body readability and connection to the headline']
          : ['make the fewest changes needed for balanced hierarchy, proximity and readability'],
      goals: [
        'preserve brand consistency',
        'improve hierarchy and visual balance',
        'avoid crowded text blocks',
        'treat headline and body as a single visual group on standard templates',
        'never shrink standard body copy below the readable minimum',
        'avoid excessive visual distance between headline and body',
        'keep important content inside the safe area whenever the template allows it',
        'avoid unnecessary changes',
      ],
    },
  };
}
