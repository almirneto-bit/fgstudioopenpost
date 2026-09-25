'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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
  const mediaBox = layout.media ?? SM_POST_SHARED.image;
  ctx.clearRect(0, 0, POST_WIDTH, POST_HEIGHT);
  const layoutBackground = layout.kind === 'standard'
    ? (layout.background ?? '#1a1a1a')
    : (fields.layoutBackgroundColor || layout.background || '#1a1a1a');
  const specialTextColor = specialLayoutTextColor(layoutBackground, '#FFFFFF');
  ctx.fillStyle = layoutBackground;
  ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);

  if (media) {
    drawCover(ctx, media, mediaBox, fields.imageScale, fields.imageOffsetX, fields.imageOffsetY);
  }

  if (fields.colorOverlayEnabled && fields.colorOverlayOpacity > 0) {
    fillClipped(ctx, mediaBox, fields.colorOverlay, fields.colorOverlayOpacity / 100);
  }
  if (fields.topShadowEnabled) drawVerticalGradient(ctx, mediaBox, SM_POST_SHARED.topShadow);
  if (fields.bottomShadowEnabled) drawVerticalGradient(ctx, mediaBox, SM_POST_SHARED.bottomShadow);

  if (layout.card) {
    ctx.save();
    roundedRectPath(ctx, layout.card, layout.card.radius);
    ctx.fillStyle = layout.card.color;
    ctx.fill();
    ctx.restore();
  }

  if (fields.noiseEnabled) drawNoise(ctx, fields.noiseIntensity, fields.noiseSize);

  const logoFgBox = layout.logoFg ?? SM_POST_SHARED.logoFg;
  const logoSecondaryBox = layout.logoSecondary ?? SM_POST_SHARED.logoSecondary;
  drawTintedImage(
    ctx,
    assets.logoFg,
    logoFgBox,
    FG_LOGO_COLORS[fields.logoFgColor] ?? FG_LOGO_COLORS.white,
  );
  ctx.drawImage(
    assets.logoSecondary,
    logoSecondaryBox.x,
    logoSecondaryBox.y,
    logoSecondaryBox.width,
    logoSecondaryBox.height,
  );

  if (layout.kind === 'post9') {
    if (layout.handle) {
      drawParagraph(ctx, textForDisplay(fields.tag, fields.tagUppercase), layout.handle, {
        ...layout.handle,
        color: specialTextColor,
        fontSize: layout.handle.fontSize,
      });
    }
    drawParagraph(ctx, textForDisplay(fields.bodyText, fields.bodyUppercase), layout.bodyText, {
      ...layout.bodyText,
      fontSize: fields.bodyFontSize,
      lineHeight: fields.bodyLineHeight,
      autoFit: false,
    });
    return;
  }

  if (layout.kind === 'standard' && layout.tag) {
    drawTag(ctx, textForDisplay(fields.tag, fields.tagUppercase), layout.tag);
  }

  const headlineBox = {
    ...layout.headline,
    y: layout.headline.y + fields.tagHeadlineOffset,
  };
  drawParagraph(ctx, textForDisplay(fields.headline, fields.headlineUppercase), headlineBox, {
    ...layout.headline,
    color: layout.kind === 'post7' || layout.kind === 'post8' ? specialTextColor : layout.headline.color,
    fontSize: fields.headlineFontSize,
    lineHeight: fields.headlineLineHeight,
    autoFit: false,
  });

  if (layout.kind === 'standard' && fields.bodyText) {
    const bodyBox = {
      ...layout.bodyText,
      y: layout.bodyText.y + fields.tagHeadlineOffset + fields.headlineBodyOffset,
    };
    drawParagraph(ctx, textForDisplay(fields.bodyText, fields.bodyUppercase), bodyBox, {
      ...layout.bodyText,
      fontSize: fields.bodyFontSize,
      lineHeight: fields.bodyLineHeight,
      autoFit: false,
    });
  }
}

function makeCanvas(width = POST_WIDTH, height = POST_HEIGHT) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`Falha ao gerar ${type}.`)), type, quality);
  });
}

function waitForSeek(video: HTMLVideoElement, target: number) {
  return new Promise<void>((resolve, reject) => {
    const safeTarget = Math.max(0, Math.min(target, Math.max(0, video.duration - 0.001)));
    if (Math.abs(video.currentTime - safeTarget) < 0.002 && video.readyState >= 2) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
    };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Falha ao avançar o vídeo durante a exportação.')); };
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', fail, { once: true });
    timer = setTimeout(() => { cleanup(); resolve(); }, 2500);
    try {
      video.currentTime = safeTarget;
    } catch {
      cleanup();
      resolve();
    }
  });
}

async function createExportMedia(fields: SmPostFields) {
  if (!fields.imageUrl || !fields.mediaType) return null;
  if (fields.mediaType === 'image') return loadImage(fields.imageUrl);
  const video = createVideo(fields.imageUrl, false);
  await waitForVideo(video);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const trimStart = Math.max(0, Math.min(fields.videoTrimStart, duration));
  await waitForSeek(video, trimStart);
  return video;
}

export async function renderPostBlob(fields: SmPostFields) {
  const assets = await prepareAssets();
  const media = await createExportMedia(fields);
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');
  drawScene(ctx, fields, assets, media);
  if (media instanceof HTMLVideoElement) {
    media.pause();
    media.removeAttribute('src');
    media.load();
  }
  return canvasToBlob(canvas, 'image/png');
}

class GifWriter {
  private bytes: number[] = [];
  byte(value: number) { this.bytes.push(value & 255); }
  word(value: number) { this.byte(value); this.byte(value >> 8); }
  ascii(value: string) { for (let index = 0; index < value.length; index++) this.byte(value.charCodeAt(index)); }
  block(data: Uint8Array) {
    for (let offset = 0; offset < data.length; offset += 255) {
      const size = Math.min(255, data.length - offset);
      this.byte(size);
      for (let index = 0; index < size; index++) this.byte(data[offset + index]);
    }
    this.byte(0);
  }
  blob() { return new Blob([new Uint8Array(this.bytes)], { type: 'image/gif' }); }
}

function gifPalette() {
  const palette = new Uint8Array(256 * 3);
  for (let r = 0; r < 8; r++) {
    for (let g = 0; g < 8; g++) {
      for (let b = 0; b < 4; b++) {
        const index = (r << 5) | (g << 2) | b;
        palette[index * 3] = Math.round((r / 7) * 255);
        palette[index * 3 + 1] = Math.round((g / 7) * 255);
        palette[index * 3 + 2] = Math.round((b / 3) * 255);
      }
    }
  }
  return palette;
}

function rgbaToPaletteIndices(data: Uint8ClampedArray, width: number, height: number) {
  const indices = new Uint8Array(width * height);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      const index = pixel * 4;
      const d = (bayer[(y & 3) * 4 + (x & 3)] - 7.5) * 1.4;
      const r = Math.max(0, Math.min(255, data[index] + d));
      const g = Math.max(0, Math.min(255, data[index + 1] + d));
      const b = Math.max(0, Math.min(255, data[index + 2] + d));
      indices[pixel] = ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
    }
  }
  return indices;
}

function gifLzwEncode(indices: Uint8Array) {
  const minCodeSize = 8;
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const output: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let dictionary = new Map<number, number>();

  const writeCode = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuffer & 255);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };

  const reset = () => {
    dictionary = new Map<number, number>();
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
  };

  writeCode(clearCode);
  if (indices.length === 0) {
    writeCode(endCode);
  } else {
    let prefix = indices[0];
    for (let index = 1; index < indices.length; index++) {
      const symbol = indices[index];
      const key = (prefix << 8) | symbol;
      const found = dictionary.get(key);
      if (found !== undefined) {
        prefix = found;
        continue;
      }
      writeCode(prefix);
      if (nextCode < 4096) {
        dictionary.set(key, nextCode++);
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        writeCode(clearCode);
        reset();
      }
      prefix = symbol;
    }
    writeCode(prefix);
    writeCode(endCode);
  }
  if (bitCount > 0) output.push(bitBuffer & 255);
  return new Uint8Array(output);
}

function createGifHeader(writer: GifWriter, width: number, height: number) {
  writer.ascii('GIF89a');
  writer.word(width);
  writer.word(height);
  writer.byte(0xf7);
  writer.byte(0);
  writer.byte(0);
  const palette = gifPalette();
  for (const value of palette) writer.byte(value);
  writer.byte(0x21); writer.byte(0xff); writer.byte(0x0b);
  writer.ascii('NETSCAPE2.0');
  writer.byte(0x03); writer.byte(0x01); writer.word(0); writer.byte(0);
}

function addGifFrame(writer: GifWriter, indices: Uint8Array, width: number, height: number, delayCs: number) {
  writer.byte(0x21); writer.byte(0xf9); writer.byte(0x04);
  writer.byte(0x00); writer.word(delayCs); writer.byte(0); writer.byte(0);
  writer.byte(0x2c); writer.word(0); writer.word(0); writer.word(width); writer.word(height); writer.byte(0);
  writer.byte(8);
  writer.block(gifLzwEncode(indices));
}

async function buildGif(fields: SmPostFields, src: string, onProgress?: ExportProgress) {
  const video = createVideo(src, false);
  await waitForVideo(video);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration) throw new Error('Não foi possível identificar a duração do vídeo.');
  const trimStart = Math.max(0, Math.min(fields.videoTrimStart, duration));
  const trimEnd = Math.min(fields.videoTrimEnd ?? duration, duration);
  const trimmedDuration = trimEnd - trimStart;
  if (trimmedDuration <= 0.01) throw new Error('O recorte do vídeo precisa ter uma duração maior que zero.');
  if (trimmedDuration > GIF_MAX_DURATION) throw new Error(`Para manter o arquivo viável, o GIF aceita recortes de até ${GIF_MAX_DURATION}s.`);

  const assets = await prepareAssets();
  const full = makeCanvas();
  const fullCtx = full.getContext('2d');
  const staging = makeCanvas(GIF_WIDTH, GIF_HEIGHT);
  const stagingCtx = staging.getContext('2d', { willReadFrequently: true });
  if (!fullCtx || !stagingCtx) throw new Error('Canvas indisponível neste navegador.');

  const writer = new GifWriter();
  createGifHeader(writer, GIF_WIDTH, GIF_HEIGHT);
  const totalFrames = Math.max(1, Math.ceil(trimmedDuration * GIF_FPS));
  const delayCs = Math.max(2, Math.round(100 / GIF_FPS));

  for (let frame = 0; frame < totalFrames; frame++) {
    await waitForSeek(video, Math.min(trimEnd - 0.001, trimStart + frame / GIF_FPS));
    drawScene(fullCtx, fields, assets, video);
    stagingCtx.clearRect(0, 0, GIF_WIDTH, GIF_HEIGHT);
    stagingCtx.drawImage(full, 0, 0, GIF_WIDTH, GIF_HEIGHT);
    const imageData = stagingCtx.getImageData(0, 0, GIF_WIDTH, GIF_HEIGHT);
    const indices = rgbaToPaletteIndices(imageData.data, GIF_WIDTH, GIF_HEIGHT);
    addGifFrame(writer, indices, GIF_WIDTH, GIF_HEIGHT, delayCs);
    onProgress?.((frame + 1) / totalFrames);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  writer.byte(0x3b);
  video.removeAttribute('src');
  video.load();
  return writer.blob();
}

function supportedMp4MimeType(includeAudio: boolean) {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = includeAudio
    ? [
        'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
      ]
    : [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1',
        'video/mp4',
      ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

type CapturableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  webkitCaptureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

function captureOriginalMediaStream(video: HTMLVideoElement) {
  const source = video as CapturableVideo;
  const capture = source.captureStream ?? source.webkitCaptureStream ?? source.mozCaptureStream;
  if (!capture) {
    throw new Error('Este navegador não consegue capturar o áudio do vídeo original. Desative “Manter áudio no MP4” ou use uma versão atual do Chrome/Edge.');
  }
  const stream = capture.call(source);
  if (!stream.getAudioTracks().length) {
    for (const track of stream.getTracks()) track.stop();
    throw new Error('Não foi encontrada uma faixa de áudio compatível neste vídeo.');
  }
  return stream;
}

async function buildMp4(fields: SmPostFields, src: string, onProgress?: ExportProgress) {
  const includeAudio = fields.keepVideoAudio;
  const mimeType = supportedMp4MimeType(includeAudio);
  if (!mimeType) {
    throw new Error(includeAudio
      ? 'Este navegador não oferece exportação MP4/H.264 com áudio AAC. Desative “Manter áudio no MP4” ou use uma versão atual do Chrome/Edge.'
      : 'Este navegador não oferece gravação MP4/H.264. Use uma versão atual do Chrome ou Edge.');
  }

  const video = createVideo(src, false);
  await waitForVideo(video);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration) throw new Error('Não foi possível identificar a duração do vídeo.');
  const trimStart = Math.max(0, Math.min(fields.videoTrimStart, duration));
  const trimEnd = Math.min(fields.videoTrimEnd ?? duration, duration);
  const trimmedDuration = trimEnd - trimStart;
  if (trimmedDuration <= 0.01) throw new Error('O recorte do vídeo precisa ter uma duração maior que zero.');

  const assets = await prepareAssets();
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof canvas.captureStream !== 'function') throw new Error('Seu navegador não oferece exportação de vídeo pelo canvas.');

  video.currentTime = trimStart;
  await waitForSeek(video, trimStart);
  drawScene(ctx, fields, assets, video);

  const canvasStream = canvas.captureStream(MP4_FPS);
  let sourceMediaStream: MediaStream | null = null;
  let stream = canvasStream;
  if (includeAudio) {
    sourceMediaStream = captureOriginalMediaStream(video);
    stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...sourceMediaStream.getAudioTracks(),
    ]);
  }

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
    ...(includeAudio ? { audioBitsPerSecond: 192_000 } : {}),
  });
  recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });

  let raf = 0;
  let progressTimer: ReturnType<typeof setInterval> | undefined;
  let finishPlayback: (() => void) | null = null;
  const paint = () => {
    drawScene(ctx, fields, assets, video);
    if (video.currentTime >= trimEnd || video.ended) {
      video.pause();
      finishPlayback?.();
      return;
    }
    raf = requestAnimationFrame(paint);
  };

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(), { once: true });
    recorder.addEventListener('error', () => reject(new Error('O navegador interrompeu a exportação MP4.')), { once: true });
  });

  try {
    recorder.start(500);
    raf = requestAnimationFrame(paint);
    progressTimer = setInterval(() => {
      onProgress?.(Math.min(0.99, Math.max(0, (video.currentTime - trimStart) / trimmedDuration)));
    }, 150);
    const playbackFinished = new Promise<void>((resolve, reject) => {
      finishPlayback = resolve;
      video.addEventListener('ended', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('Falha ao reproduzir o vídeo durante a exportação.')), { once: true });
    });
    await video.play();
    await playbackFinished;
    drawScene(ctx, fields, assets, video);
    recorder.stop();
    await stopped;
    onProgress?.(1);
  } finally {
    cancelAnimationFrame(raf);
    if (progressTimer) clearInterval(progressTimer);
    for (const track of stream.getTracks()) track.stop();
    for (const track of canvasStream.getTracks()) {
      if (track.readyState === 'live') track.stop();
    }
    if (sourceMediaStream) {
      for (const track of sourceMediaStream.getTracks()) {
        if (track.readyState === 'live') track.stop();
      }
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  return new Blob(chunks, { type: 'video/mp4' });
}

const SmPostCanvas = forwardRef<
  SmPostCanvasHandle,
  {
    fields: SmPostFields;
    onError: (message: string) => void;
    onVideoStateChange?: (state: VideoPreviewState) => void;
  }
>(function SmPostCanvas({ fields, onError, onVideoStateChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldsRef = useRef(fields);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const assetsRef = useRef<PreparedAssets | null>(null);
  const rafRef = useRef(0);
  const lastVideoStateAtRef = useRef(0);
  fieldsRef.current = fields;

  const emitVideoState = (video: HTMLVideoElement, force = false) => {
    const now = performance.now();
    if (!force && now - lastVideoStateAtRef.current < 100) return;
    lastVideoStateAtRef.current = now;
    onVideoStateChange?.({
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      isPlaying: !video.paused && !video.ended,
    });
  };

  const paintVisible = () => {
    const canvas = canvasRef.current;
    const assets = assetsRef.current;
    if (!canvas || !assets) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, fieldsRef.current, assets, mediaRef.current);
  };

  useEffect(() => {
    let cancelled = false;
    prepareAssets()
      .then((assets) => {
        if (cancelled) return;
        assetsRef.current = assets;
        paintVisible();
      })
      .catch(() => {
        if (!cancelled) onError('Não foi possível carregar os logos do post.');
      });
    return () => { cancelled = true; };
  }, [onError]);

  useEffect(() => {
    paintVisible();
  }, [fields]);

  useEffect(() => {
    let cancelled = false;
    cancelAnimationFrame(rafRef.current);
    const previous = mediaRef.current;
    if (previous instanceof HTMLVideoElement) {
      previous.pause();
      previous.removeAttribute('src');
      previous.load();
    }
    mediaRef.current = null;

    const start = async () => {
      if (!fields.imageUrl || !fields.mediaType) {
        onVideoStateChange?.({ duration: 0, currentTime: 0, isPlaying: false });
        paintVisible();
        return;
      }
      try {
        if (fields.mediaType === 'image') {
          const image = await loadImage(fields.imageUrl);
          if (cancelled) return;
          mediaRef.current = image;
          paintVisible();
          onError('');
          return;
        }

        const video = createVideo(fields.imageUrl, false);
        await waitForVideo(video);
        if (cancelled) return;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const startAt = Math.max(0, Math.min(fieldsRef.current.videoTrimStart, duration));
        await waitForSeek(video, startAt);
        if (cancelled) return;
        mediaRef.current = video;
        emitVideoState(video, true);
        const tick = () => {
          if (cancelled) return;
          const currentFields = fieldsRef.current;
          const trimEnd = Math.min(currentFields.videoTrimEnd ?? duration, duration);
          if (!video.paused && video.currentTime >= trimEnd) {
            video.pause();
            video.currentTime = trimEnd;
            emitVideoState(video, true);
          }
          paintVisible();
          emitVideoState(video);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
        onError('');
      } catch (error) {
        if (!cancelled) onError(error instanceof Error ? error.message : 'Não foi possível carregar a mídia.');
      }
    };

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      const current = mediaRef.current;
      if (current instanceof HTMLVideoElement) {
        current.pause();
        current.removeAttribute('src');
        current.load();
      }
      mediaRef.current = null;
    };
  }, [fields.imageUrl, fields.mediaType, onError, onVideoStateChange]);

  useEffect(() => {
    const current = mediaRef.current;
    if (!(current instanceof HTMLVideoElement)) return;
    const duration = Number.isFinite(current.duration) ? current.duration : 0;
    if (!duration) return;
    const trimStart = Math.max(0, Math.min(fields.videoTrimStart, duration));
    const trimEnd = Math.min(fields.videoTrimEnd ?? duration, duration);
    if (current.currentTime < trimStart || current.currentTime > trimEnd) {
      current.currentTime = trimStart;
      paintVisible();
      emitVideoState(current, true);
    }
  }, [fields.videoTrimStart, fields.videoTrimEnd]);

  useImperativeHandle(ref, () => ({
    exportPng: async () => {
      const assets = await prepareAssets();
      const canvas = makeCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível neste navegador.');
      drawScene(ctx, fieldsRef.current, assets, mediaRef.current);
      return canvasToBlob(canvas, 'image/png');
    },
    exportGif: async (onProgress) => {
      const current = fieldsRef.current;
      if (current.mediaType !== 'video' || !current.imageUrl) throw new Error('Envie um vídeo para exportar em GIF.');
      return buildGif(current, current.imageUrl, onProgress);
    },
    exportMp4: async (onProgress) => {
      const current = fieldsRef.current;
      if (current.mediaType !== 'video' || !current.imageUrl) throw new Error('Envie um vídeo para exportar em MP4.');
      return buildMp4(current, current.imageUrl, onProgress);
    },
    togglePlayback: () => {
      const video = mediaRef.current;
      if (!(video instanceof HTMLVideoElement)) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const start = Math.max(0, Math.min(fieldsRef.current.videoTrimStart, duration));
      const end = Math.min(fieldsRef.current.videoTrimEnd ?? duration, duration);
      if (video.paused) {
        if (video.currentTime < start || video.currentTime >= end - 0.01) video.currentTime = start;
        video.play()
          .then(() => emitVideoState(video, true))
          .catch(() => onError('Não foi possível reproduzir este vídeo no navegador.'));
      } else {
        video.pause();
        emitVideoState(video, true);
      }
    },
    seekVideo: (time) => {
      const video = mediaRef.current;
      if (!(video instanceof HTMLVideoElement)) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const start = Math.max(0, Math.min(fieldsRef.current.videoTrimStart, duration));
      const end = Math.min(fieldsRef.current.videoTrimEnd ?? duration, duration);
      video.currentTime = Math.max(start, Math.min(time, end));
      paintVisible();
      emitVideoState(video, true);
    },
  }));

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
