'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  POST_HEIGHT,
  POST_WIDTH,
  SM_POST_LAYOUTS,
  SM_POST_SHARED,
  type SmPostFields,
  type TextAlign,
} from '@/lib/smPostTemplate';

export type SmPostCanvasHandle = { exportPng: () => Promise<Blob | null> };

function measureLine(ctx: CanvasRenderingContext2D, text: string, letterSpacing = 0) {
  return ctx.measureText(text).width + letterSpacing * Math.max(0, text.length - 1);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, letterSpacing = 0): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const attempt = current ? `${current} ${word}` : word;
      if (measureLine(ctx, attempt, letterSpacing) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = attempt;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: { width: number; height: number },
  opts: {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    minFontSize: number;
    lineHeight: number;
    letterSpacing?: number;
  },
) {
  let fontSize = opts.fontSize;
  while (fontSize > opts.minFontSize) {
    ctx.font = `${opts.fontWeight} ${fontSize}px ${opts.fontFamily}`;
    const lines = wrapLines(ctx, text, box.width, opts.letterSpacing);
    const totalHeight = lines.length * fontSize * opts.lineHeight;
    const widestLine = Math.max(0, ...lines.map((line) => measureLine(ctx, line, opts.letterSpacing)));
    if (totalHeight <= box.height && widestLine <= box.width) return { fontSize, lines };
    fontSize -= 2;
  }
  ctx.font = `${opts.fontWeight} ${opts.minFontSize}px ${opts.fontFamily}`;
  return {
    fontSize: opts.minFontSize,
    lines: wrapLines(ctx, text, box.width, opts.letterSpacing),
  };
}

function drawLetterSpaced(
  ctx: CanvasRenderingContext2D,
  line: string,
  anchorX: number,
  y: number,
  spacing: number,
  align: TextAlign,
) {
  const widths = [...line].map((character) => ctx.measureText(character).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, line.length - 1);
  let x = align === 'center' ? anchorX - totalWidth / 2 : align === 'right' ? anchorX - totalWidth : anchorX;
  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  [...line].forEach((character, index) => {
    ctx.fillText(character, x, y);
    x += widths[index] + spacing;
  });
  ctx.textAlign = previousAlign;
}

function drawParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; width: number; height: number },
  opts: {
    align: TextAlign;
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    minFontSize: number;
    lineHeight: number;
    color: string;
    letterSpacing?: number;
  },
) {
  const fitted = fitFontSize(ctx, text, box, opts);
  ctx.font = `${opts.fontWeight} ${fitted.fontSize}px ${opts.fontFamily}`;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align;
  ctx.textBaseline = 'middle';
  const lineHeightPx = fitted.fontSize * opts.lineHeight;
  const totalHeight = fitted.lines.length * lineHeightPx;
  let cursorY = box.y + box.height / 2 - totalHeight / 2 + lineHeightPx / 2;
  const anchorX = opts.align === 'center' ? box.x + box.width / 2 : opts.align === 'right' ? box.x + box.width : box.x;
  for (const line of fitted.lines) {
    if ((opts.letterSpacing ?? 0) !== 0 && line) {
      drawLetterSpaced(ctx, line, anchorX, cursorY, opts.letterSpacing ?? 0, opts.align);
    } else if (line) {
      ctx.fillText(line, anchorX, cursorY);
    }
    cursorY += lineHeightPx;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  scaleMultiplier = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const coverScale = Math.max(box.width / image.width, box.height / image.height);
  const scale = coverScale * scaleMultiplier;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = box.x + (box.width - drawWidth) / 2 + offsetX;
  const drawY = box.y + (box.height - drawHeight) / 2 + offsetY;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawVerticalGradient(
  ctx: CanvasRenderingContext2D,
  stops: ReadonlyArray<{ offset: number; color: string }>,
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, POST_HEIGHT);
  for (const stop of stops) gradient.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
}

function drawNoise(ctx: CanvasRenderingContext2D, intensity: number, grainSize: number) {
  if (intensity <= 0) return;
  const safeGrainSize = Math.max(1, Math.round(grainSize));
  const width = Math.ceil(POST_WIDTH / safeGrainSize);
  const height = Math.ceil(POST_HEIGHT / safeGrainSize);
  const noise = document.createElement('canvas');
  noise.width = width;
  noise.height = height;
  const noiseContext = noise.getContext('2d');
  if (!noiseContext) return;

  const imageData = noiseContext.createImageData(width, height);
  const data = imageData.data;
  let seed = 1337;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let index = 0; index < data.length; index += 4) {
    const value = random() > 0.5 ? 255 : 0;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }

  noiseContext.putImageData(imageData, 0, 0);
  ctx.save();
  ctx.globalAlpha = (intensity / 100) * 0.22;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, POST_WIDTH, POST_HEIGHT);
  ctx.restore();
}

function drawTag(ctx: CanvasRenderingContext2D, tagText: string, tag: NonNullable<(typeof SM_POST_LAYOUTS)['classic']['tag']>) {
  ctx.font = `${tag.fontWeight} ${tag.fontSize}px ${tag.fontFamily}`;
  const textWidth = measureLine(ctx, tagText, tag.letterSpacing);
  const pillWidth = textWidth + tag.paddingX * 2;
  const pillX = tag.centerX - pillWidth / 2;
  const radius = Math.min(tag.cornerRadius, tag.height / 2, pillWidth / 2);
  ctx.fillStyle = tag.background;
  ctx.beginPath();
  ctx.moveTo(pillX + radius, tag.y);
  ctx.arcTo(pillX + pillWidth, tag.y, pillX + pillWidth, tag.y + tag.height, radius);
  ctx.arcTo(pillX + pillWidth, tag.y + tag.height, pillX, tag.y + tag.height, radius);
  ctx.arcTo(pillX, tag.y + tag.height, pillX, tag.y, radius);
  ctx.arcTo(pillX, tag.y, pillX + pillWidth, tag.y, radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tag.textColor;
  ctx.textBaseline = 'middle';
  drawLetterSpaced(ctx, tagText, tag.centerX, tag.y + tag.height / 2 + 1, tag.letterSpacing, 'center');
}

async function renderPost(fields: SmPostFields) {
  await Promise.all([
    document.fonts.load('400 168px "Vina Sans"'),
    document.fonts.load('500 80px "Kanit"'),
    document.fonts.load('400 24px "Noto Sans"'),
    document.fonts.load('700 24px "Noto Sans"'),
  ]);

  const layout = SM_POST_LAYOUTS[fields.layoutId] ?? SM_POST_LAYOUTS.classic;
  const buffer = document.createElement('canvas');
  buffer.width = POST_WIDTH;
  buffer.height = POST_HEIGHT;
  const ctx = buffer.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
  if (fields.imageUrl) {
    try {
      const image = await loadImage(fields.imageUrl);
      drawCover(ctx, image, SM_POST_SHARED.image, fields.imageScale, fields.imageOffsetX, fields.imageOffsetY);
    } catch {
      throw new Error('Não foi possível carregar a imagem. Envie outro arquivo.');
    }
  }

  if (fields.colorOverlayEnabled && fields.colorOverlayOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = fields.colorOverlayOpacity / 100;
    ctx.fillStyle = fields.colorOverlay;
    ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
    ctx.restore();
  }
  if (fields.topShadowEnabled) drawVerticalGradient(ctx, SM_POST_SHARED.topShadow);
  if (fields.bottomShadowEnabled) drawVerticalGradient(ctx, SM_POST_SHARED.bottomShadow);
  if (fields.noiseEnabled) drawNoise(ctx, fields.noiseIntensity, fields.noiseSize);

  try {
    const [logoFg, logoSecondary] = await Promise.all([
      loadImage(SM_POST_SHARED.logoFg.src),
      loadImage(SM_POST_SHARED.logoSecondary.src),
    ]);
    ctx.drawImage(logoFg, SM_POST_SHARED.logoFg.x, SM_POST_SHARED.logoFg.y, SM_POST_SHARED.logoFg.width, SM_POST_SHARED.logoFg.height);
    ctx.drawImage(logoSecondary, SM_POST_SHARED.logoSecondary.x, SM_POST_SHARED.logoSecondary.y, SM_POST_SHARED.logoSecondary.width, SM_POST_SHARED.logoSecondary.height);
  } catch {
    throw new Error('Não foi possível carregar os logos do post.');
  }

  if (layout.tag) drawTag(ctx, fields.tag, layout.tag);
  const headlineBox = { ...layout.headline, y: layout.headline.y + fields.tagHeadlineOffset };
  const bodyBox = {
    ...layout.bodyText,
    y: layout.bodyText.y + fields.tagHeadlineOffset + fields.headlineBodyOffset,
  };

  drawParagraph(ctx, fields.headline, headlineBox, {
    ...layout.headline,
    fontSize: fields.headlineFontSize,
  });
  drawParagraph(ctx, fields.bodyText, bodyBox, {
    ...layout.bodyText,
    fontSize: fields.bodyFontSize,
  });
  return buffer;
}

export async function renderPostBlob(fields: SmPostFields) {
  const buffer = await renderPost(fields);
  return new Promise<Blob>((resolve, reject) => {
    buffer.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG.')),
      'image/png',
    );
  });
}

const SmPostCanvas = forwardRef<
  SmPostCanvasHandle,
  { fields: SmPostFields; onError: (message: string) => void }
>(function SmPostCanvas({ fields, onError }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    renderPost(fields)
      .then((buffer) => {
        if (!cancelled) {
          canvas.getContext('2d')?.drawImage(buffer, 0, 0);
          onError('');
        }
      })
      .catch((error) => {
        if (!cancelled) onError(error instanceof Error ? error.message : 'Falha ao renderizar.');
      });
    return () => { cancelled = true; };
  }, [fields, onError]);

  useImperativeHandle(ref, () => ({ exportPng: () => renderPostBlob(fields) }));

  return (
    <canvas
      ref={canvasRef}
      width={POST_WIDTH}
      height={POST_HEIGHT}
      className="sm-post-canvas"
      aria-label="Prévia da lâmina"
    />
  );
});

export default SmPostCanvas;
