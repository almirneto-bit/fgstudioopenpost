'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type MouseEvent } from 'react';
import {
  FG_LOGO_COLORS,
  POST_HEIGHT,
  POST_WIDTH,
  SM_POST_LAYOUTS,
  SM_POST_SHARED,
  type MediaBox,
  type SmPostFields,
  type TextAlign,
} from '@/lib/smPostTemplate';

const GIF_WIDTH = 720;
const GIF_HEIGHT = 960;
const GIF_FPS = 10;
const GIF_MAX_DURATION = 30;
const MP4_FPS = 30;

export type ExportProgress = (progress: number) => void;

export type SmPostCanvasHandle = {
  exportPng: () => Promise<Blob | null>;
  exportGif: (onProgress?: ExportProgress) => Promise<Blob>;
  exportMp4: (onProgress?: ExportProgress) => Promise<Blob>;
  togglePlayback: () => void;
  seekVideo: (time: number) => void;
};

type VideoPreviewState = {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
};

type PreparedAssets = {
  logoFg: HTMLImageElement;
  logoSecondary: HTMLImageElement;
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const noiseCache = new Map<number, HTMLCanvasElement>();
let preparedAssetsPromise: Promise<PreparedAssets> | null = null;

function textForDisplay(text: string, uppercase: boolean) {
  return uppercase ? text.toLocaleUpperCase('pt-BR') : text;
}

function specialLayoutTextColor(background: string, fallback: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(background.trim());
  if (!match) return fallback;
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
  return yiq >= 155 ? '#0C0C0F' : '#FFFFFF';
}

function measureLine(ctx: CanvasRenderingContext2D, text: string, letterSpacing = 0) {
  return ctx.measureText(text).width + letterSpacing * Math.max(0, [...text].length - 1);
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
  return { fontSize: opts.minFontSize, lines: wrapLines(ctx, text, box.width, opts.letterSpacing) };
}

function drawLetterSpaced(
  ctx: CanvasRenderingContext2D,
  line: string,
  anchorX: number,
  y: number,
  spacing: number,
  align: TextAlign,
) {
  const chars = [...line];
  const widths = chars.map((character) => ctx.measureText(character).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, chars.length - 1);
  let x = align === 'center' ? anchorX - totalWidth / 2 : align === 'right' ? anchorX - totalWidth : anchorX;
  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((character, index) => {
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
    autoFit?: boolean;
  },
) {
  if (!text) return;
  const fitted = opts.autoFit === false
    ? (() => {
        ctx.font = `${opts.fontWeight} ${opts.fontSize}px ${opts.fontFamily}`;
        return { fontSize: opts.fontSize, lines: wrapLines(ctx, text, box.width, opts.letterSpacing) };
      })()
    : fitFontSize(ctx, text, box, opts);
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
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

function waitForVideo(video: HTMLVideoElement): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      resolve(video);
      return;
    }
    const onLoaded = () => { cleanup(); resolve(video); };
    const onError = () => { cleanup(); reject(new Error('Não foi possível carregar o vídeo. Tente MP4 (H.264) ou WebM.')); };
    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function createVideo(src: string, loop: boolean) {
  const video = document.createElement('video');
  video.src = src;
  video.preload = 'auto';
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = loop;
  return video;
}

function mediaDimensions(media: HTMLImageElement | HTMLVideoElement) {
  if (media instanceof HTMLVideoElement) return { width: media.videoWidth, height: media.videoHeight };
  return { width: media.naturalWidth || media.width, height: media.naturalHeight || media.height };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  radius?: { tl: number; tr: number; br: number; bl: number },
) {
  const r = radius ?? { tl: 0, tr: 0, br: 0, bl: 0 };
  const maxRadius = Math.min(box.width / 2, box.height / 2);
  const tl = Math.min(maxRadius, Math.max(0, r.tl));
  const tr = Math.min(maxRadius, Math.max(0, r.tr));
  const br = Math.min(maxRadius, Math.max(0, r.br));
  const bl = Math.min(maxRadius, Math.max(0, r.bl));
  ctx.beginPath();
  ctx.moveTo(box.x + tl, box.y);
  ctx.lineTo(box.x + box.width - tr, box.y);
  ctx.quadraticCurveTo(box.x + box.width, box.y, box.x + box.width, box.y + tr);
  ctx.lineTo(box.x + box.width, box.y + box.height - br);
  ctx.quadraticCurveTo(box.x + box.width, box.y + box.height, box.x + box.width - br, box.y + box.height);
  ctx.lineTo(box.x + bl, box.y + box.height);
  ctx.quadraticCurveTo(box.x, box.y + box.height, box.x, box.y + box.height - bl);
  ctx.lineTo(box.x, box.y + tl);
  ctx.quadraticCurveTo(box.x, box.y, box.x + tl, box.y);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  box: MediaBox,
  scaleMultiplier = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const size = mediaDimensions(media);
  if (!size.width || !size.height) return;
  const coverScale = Math.max(box.width / size.width, box.height / size.height);
  const scale = coverScale * scaleMultiplier;
  const drawWidth = size.width * scale;
  const drawHeight = size.height * scale;
  const drawX = box.x + (box.width - drawWidth) / 2 + offsetX;
  const drawY = box.y + (box.height - drawHeight) / 2 + offsetY;
  ctx.save();
  roundedRectPath(ctx, box, box.radius);
  ctx.clip();
  ctx.drawImage(media, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function fillClipped(
  ctx: CanvasRenderingContext2D,
  box: MediaBox,
  fill: string,
  alpha = 1,
) {
  ctx.save();
  roundedRectPath(ctx, box, box.radius);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.restore();
}

function drawVerticalGradient(
  ctx: CanvasRenderingContext2D,
  box: MediaBox,
  stops: ReadonlyArray<{ offset: number; color: string }>,
) {
  ctx.save();
  roundedRectPath(ctx, box, box.radius);
  ctx.clip();
  const gradient = ctx.createLinearGradient(0, box.y, 0, box.y + box.height);
  for (const stop of stops) gradient.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = gradient;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.restore();
}

function drawTintedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  color: string,
) {
  const buffer = document.createElement('canvas');
  buffer.width = Math.max(1, Math.round(box.width));
  buffer.height = Math.max(1, Math.round(box.height));
  const bctx = buffer.getContext('2d');
  if (!bctx) return;
  bctx.drawImage(image, 0, 0, buffer.width, buffer.height);
  bctx.globalCompositeOperation = 'source-in';
  bctx.fillStyle = color;
  bctx.fillRect(0, 0, buffer.width, buffer.height);
  ctx.drawImage(buffer, box.x, box.y, box.width, box.height);
}

function drawNoise(ctx: CanvasRenderingContext2D, intensity: number, grainSize: number) {
  if (intensity <= 0) return;
  const safeGrainSize = Math.max(1, Math.round(grainSize));
  let noise = noiseCache.get(safeGrainSize);
  if (!noise) {
    const width = Math.ceil(POST_WIDTH / safeGrainSize);
    const height = Math.ceil(POST_HEIGHT / safeGrainSize);
    noise = document.createElement('canvas');
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
    noiseCache.set(safeGrainSize, noise);
  }
  ctx.save();
  ctx.globalAlpha = (intensity / 100) * 0.22;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, POST_WIDTH, POST_HEIGHT);
  ctx.restore();
}

function drawTag(
  ctx: CanvasRenderingContext2D,
  text: string,
  tag: NonNullable<(typeof SM_POST_LAYOUTS)['classic']['tag']>,
) {
  if (!text) return;
  ctx.font = `${tag.fontWeight} ${tag.fontSize}px ${tag.fontFamily}`;
  const textWidth = measureLine(ctx, text, tag.letterSpacing);
  const pillWidth = Math.max(tag.height, textWidth + tag.paddingX * 2);
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
  drawLetterSpaced(ctx, text, tag.centerX, tag.y + tag.height / 2 + 1, tag.letterSpacing, 'center');
}

async function prepareAssets(): Promise<PreparedAssets> {
  if (!preparedAssetsPromise) {
    preparedAssetsPromise = (async () => {
      if (document.fonts?.load) {
        await Promise.allSettled([
          document.fonts.load('400 168px "Vina Sans"'),
          document.fonts.load('400 56px "Kanit"'),
          document.fonts.load('500 80px "Kanit"'),
          document.fonts.load('400 24px "Noto Sans"'),
          document.fonts.load('700 24px "Noto Sans"'),
        ]);
      }
      const [logoFg, logoSecondary] = await Promise.all([
        loadImage(SM_POST_SHARED.logoFg.src),
        loadImage(SM_POST_SHARED.logoSecondary.src),
      ]);
      return { logoFg, logoSecondary };
    })();
  }
  return preparedAssetsPromise;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  fields: SmPostFields,
  assets: PreparedAssets,
  media: HTMLImageElement | HTMLVideoElement | null,
) {
  const layout = SM_POST_LAYOUTS[fields.layoutId] ?? SM_POST_LAYOUTS.classic;
  const headlineBox = {
    ...layout.headline,
    y: layout.headline.y + fields.tagHeadlineOffset,
  };
  const bodyBox = layout.kind === 'post9'
    ? layout.bodyText
    : {
        ...layout.bodyText,
        y: layout.bodyText.y + fields.tagHeadlineOffset + fields.headlineBodyOffset,
      };
  const handleBox = layout.kind === 'post9' ? layout.handle : undefined;

  const editableBox = editingField === 'headline'
    ? headlineBox
    : editingField === 'bodyText'
      ? bodyBox
      : editingField === 'tag'
        ? (handleBox ?? (layout.tag
          ? {
              x: layout.tag.centerX - 230,
              y: layout.tag.y,
              width: 460,
              height: Math.max(layout.tag.height, 64),
              align: 'center' as const,
              color: layout.tag.textColor,
              fontFamily: layout.tag.fontFamily,
              fontWeight: layout.tag.fontWeight,
              fontSize: layout.tag.fontSize,
              lineHeight: 1,
            }
          : undefined))
        : undefined;

  const editableValue = editingField === 'headline'
    ? textForDisplay(fields.headline, fields.headlineUppercase)
    : editingField === 'bodyText'
      ? textForDisplay(fields.bodyText, fields.bodyUppercase)
      : editingField === 'tag'
        ? textForDisplay(fields.tag, fields.tagUppercase)
        : '';

  const startEditingAtPoint = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!editable || !onTextChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * POST_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * POST_HEIGHT;
    const hit = (box: { x: number; y: number; width: number; height: number }) => (
      x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
    );

    if (layout.kind !== 'post9' && fields.headline && hit(headlineBox)) {
      setEditingField('headline');
      return;
    }
    if ((layout.kind === 'standard' || layout.kind === 'post9') && fields.bodyText && hit(bodyBox)) {
      setEditingField('bodyText');
      return;
    }
    if (layout.kind === 'post9' && handleBox && fields.tag && hit(handleBox)) {
      setEditingField('tag');
      return;
    }
    if (layout.kind === 'standard' && layout.tag && fields.tag) {
      const tagHitBox = { x: layout.tag.centerX - 230, y: layout.tag.y - 12, width: 460, height: layout.tag.height + 24 };
      if (hit(tagHitBox)) setEditingField('tag');
    }
  };

  const commitInlineEdit = (field: 'tag' | 'headline' | 'bodyText', value: string) => {
    const normalized = value.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
    const shouldUppercase = field === 'headline'
      ? fields.headlineUppercase
      : field === 'bodyText'
        ? fields.bodyUppercase
        : fields.tagUppercase;
    onTextChange?.(field, shouldUppercase ? normalized.toLowerCase() : normalized);
    setEditingField(null);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={POST_WIDTH}
        height={POST_HEIGHT}
        className="sm-post-canvas"
        aria-label="Prévia da lâmina"
        onClick={startEditingAtPoint}
      />
      {editable && editingField && editableBox && onTextChange && (
        <div
          key={editingField}
          autoFocus
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          className="sm-post-inline-text-editor"
          onBlur={(event) => commitInlineEdit(editingField, event.currentTarget.innerText)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setEditingField(null);
            }
          }}
          style={{
            left: `${editableBox.x * canvasScale}px`,
            top: `${editableBox.y * canvasScale}px`,
            width: `${editableBox.width * canvasScale}px`,
            minHeight: `${Math.max(editableBox.height, 56) * canvasScale}px`,
            fontSize: `${(editingField === 'headline'
              ? fields.headlineFontSize
              : editingField === 'bodyText'
                ? fields.bodyFontSize
                : editableBox.fontSize) * canvasScale}px`,
            lineHeight: editingField === 'headline'
              ? fields.headlineLineHeight
              : editingField === 'bodyText'
                ? fields.bodyLineHeight
                : editableBox.lineHeight,
            fontFamily: editableBox.fontFamily,
            fontWeight: editableBox.fontWeight,
            textAlign: editableBox.align,
            color: editableBox.color,
          }}
        >{editableValue}</div>
      )}
    </>
  );
});

export default SmPostCanvas;
