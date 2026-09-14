'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  FG_LOGO_COLORS,
  POST_HEIGHT,
  POST_WIDTH,
  SM_POST_TEMPLATE,
  SM_POST_VARIANTS,
  type SmPostFields,
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
};

type PreparedAssets = {
  logoFg: HTMLImageElement;
  logoSecondary: HTMLImageElement;
};

type Radius = { tl: number; tr: number; br: number; bl: number };
type Box = { x: number; y: number; width: number; height: number };

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const noiseCache = new Map<number, HTMLCanvasElement>();
let preparedAssetsPromise: Promise<PreparedAssets> | null = null;

function textForDisplay(text: string, uppercase: boolean) {
  return uppercase ? text.toLocaleUpperCase('pt-BR') : text;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const attempt = current ? `${current} ${word}` : word;
      if (ctx.measureText(attempt).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else current = attempt;
    }
    if (current) lines.push(current);
  }
  return lines;
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: { width: number; height: number },
  opts: { fontFamily: string; fontWeight: number; fontSize: number; minFontSize: number; lineHeight: number },
) {
  let fontSize = opts.fontSize;
  while (fontSize > opts.minFontSize) {
    ctx.font = `${opts.fontWeight} ${fontSize}px ${opts.fontFamily}`;
    const lines = wrapLines(ctx, text, box.width);
    const totalHeight = lines.length * fontSize * opts.lineHeight;
    const widestLine = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
    if (totalHeight <= box.height && widestLine <= box.width) return { fontSize, lines };
    fontSize -= 2;
  }
  ctx.font = `${opts.fontWeight} ${opts.minFontSize}px ${opts.fontFamily}`;
  return { fontSize: opts.minFontSize, lines: wrapLines(ctx, text, box.width) };
}

function drawCenteredParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: Box,
  opts: {
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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeightPx = fitted.fontSize * opts.lineHeight;
  const totalHeight = fitted.lines.length * lineHeightPx;
  let cursorY = box.y + box.height / 2 - totalHeight / 2 + lineHeightPx / 2;
  const centerX = box.x + box.width / 2;
  for (const line of fitted.lines) {
    if ((opts.letterSpacing ?? 0) > 0 && line) drawLetterSpaced(ctx, line, centerX, cursorY, opts.letterSpacing!);
    else if (line) ctx.fillText(line, centerX, cursorY);
    cursorY += lineHeightPx;
  }
}

function drawLetterSpaced(ctx: CanvasRenderingContext2D, line: string, centerX: number, y: number, spacing: number) {
  const chars = [...line];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let x = centerX - totalWidth / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + spacing; });
  ctx.textAlign = prevAlign;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

function waitForVideo(video: HTMLVideoElement): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0) { resolve(video); return; }
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

function roundedRectPath(ctx: CanvasRenderingContext2D, box: Box, radius: Radius) {
  const { x, y, width: w, height: h } = box;
  const tl = Math.max(0, Math.min(radius.tl, w / 2, h / 2));
  const tr = Math.max(0, Math.min(radius.tr, w / 2, h / 2));
  const br = Math.max(0, Math.min(radius.br, w / 2, h / 2));
  const bl = Math.max(0, Math.min(radius.bl, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + tr); else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h); else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - bl); else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.quadraticCurveTo(x, y, x + tl, y); else ctx.lineTo(x, y);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  box: Box,
  scaleMultiplier = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const size = mediaDimensions(media);
  if (!size.width || !size.height) return;
  const coverScale = Math.max(box.width / size.width, box.height / size.height);
  const scale = coverScale * scaleMultiplier;
  const drawW = size.width * scale;
  const drawH = size.height * scale;
  const dx = box.x + (box.width - drawW) / 2 + offsetX;
  const dy = box.y + (box.height - drawH) / 2 + offsetY;
  ctx.drawImage(media, dx, dy, drawW, drawH);
}

function drawCoverClipped(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  box: Box & { radius?: Radius },
  scaleMultiplier: number,
  offsetX: number,
  offsetY: number,
) {
  ctx.save();
  if (box.radius) {
    roundedRectPath(ctx, box, box.radius);
    ctx.clip();
  }
  drawCover(ctx, media, box, scaleMultiplier, offsetX, offsetY);
  ctx.restore();
}

function drawTintedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: Box,
  color: string,
) {
  const buffer = document.createElement('canvas');
  buffer.width = Math.max(1, Math.round(box.width));
  buffer.height = Math.max(1, Math.round(box.height));
  const bctx = buffer.getContext('2d');
  if (!bctx) return;
  bctx.drawImage(img, 0, 0, buffer.width, buffer.height);
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
    const w = Math.ceil(POST_WIDTH / safeGrainSize);
    const h = Math.ceil(POST_HEIGHT / safeGrainSize);
    noise = document.createElement('canvas');
    noise.width = w;
    noise.height = h;
    const nctx = noise.getContext('2d');
    if (!nctx) return;
    const imageData = nctx.createImageData(w, h);
    const data = imageData.data;
    let seed = 1337;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < data.length; i += 4) {
      const value = random() > 0.5 ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    nctx.putImageData(imageData, 0, 0);
    noiseCache.set(safeGrainSize, noise);
  }
  ctx.save();
  ctx.globalAlpha = (intensity / 100) * 0.22;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, POST_WIDTH, POST_HEIGHT);
  ctx.restore();
}

async function prepareAssets(): Promise<PreparedAssets> {
  if (!preparedAssetsPromise) {
    preparedAssetsPromise = (async () => {
      await Promise.all([
        document.fonts.load('400 136px "Vina Sans"'),
        document.fonts.load('400 56px "Kanit"'),
        document.fonts.load('400 40px "Kanit"'),
        document.fonts.load('400 24px "Noto Sans"'),
        document.fonts.load('700 24px "Noto Sans"'),
      ]);
      const [logoFg, logoSecondary] = await Promise.all([
        loadImage(SM_POST_TEMPLATE.logoFg.src),
        loadImage(SM_POST_TEMPLATE.logoSecondary.src),
      ]);
      return { logoFg, logoSecondary };
    })();
  }
  return preparedAssetsPromise;
}

function drawLogos(ctx: CanvasRenderingContext2D, fields: SmPostFields, assets: PreparedAssets, logoFg: Box, logoSecondary: Box) {
  drawTintedImage(ctx, assets.logoFg, logoFg, FG_LOGO_COLORS[fields.logoFgColor] ?? FG_LOGO_COLORS.white);
  ctx.drawImage(assets.logoSecondary, logoSecondary.x, logoSecondary.y, logoSecondary.width, logoSecondary.height);
}

function drawTemplate1(
  ctx: CanvasRenderingContext2D,
  fields: SmPostFields,
  assets: PreparedAssets,
  media: HTMLImageElement | HTMLVideoElement | null,
) {
  const t = SM_POST_TEMPLATE;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
  if (media) drawCover(ctx, media, t.image, fields.imageScale, fields.imageOffsetX, fields.imageOffsetY);

  const grad = ctx.createLinearGradient(0, t.shadow.y, 0, t.shadow.y + t.shadow.height);
  for (const stop of t.shadow.stops) grad.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = grad;
  ctx.fillRect(t.shadow.x, t.shadow.y, t.shadow.width, t.shadow.height);

  if (fields.noiseEnabled) drawNoise(ctx, fields.noiseIntensity, fields.noiseSize);
  drawLogos(ctx, fields, assets, t.logoFg, t.logoSecondary);

  const tagCfg = t.tag;
  ctx.font = `${tagCfg.fontWeight} ${tagCfg.fontSize}px ${tagCfg.fontFamily}`;
  const tagText = textForDisplay(fields.tag, fields.tagUppercase);
  const chars = [...tagText];
  const textWidth = chars.length
    ? chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + tagCfg.letterSpacing * Math.max(0, chars.length - 1)
    : 0;
  const pillWidth = Math.max(tagCfg.height, textWidth + tagCfg.paddingX * 2);
  const pillHeight = tagCfg.height;
  const pillX = tagCfg.centerX - pillWidth / 2;
  const pillY = tagCfg.y;
  ctx.fillStyle = tagCfg.background;
  ctx.beginPath();
  const radius = Math.min(tagCfg.cornerRadius, pillHeight / 2, pillWidth / 2);
  ctx.moveTo(pillX + radius, pillY);
  ctx.arcTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + pillHeight, radius);
  ctx.arcTo(pillX + pillWidth, pillY + pillHeight, pillX, pillY + pillHeight, radius);
  ctx.arcTo(pillX, pillY + pillHeight, pillX, pillY, radius);
  ctx.arcTo(pillX, pillY, pillX + pillWidth, pillY, radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tagCfg.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawLetterSpaced(ctx, tagText, tagCfg.centerX, pillY + pillHeight / 2 + 1, tagCfg.letterSpacing);

  const headlineY = t.headline.y + fields.tagHeadlineOffset;
  const bodyY = t.bodyText.y + fields.tagHeadlineOffset + fields.headlineBodyOffset;
  drawCenteredParagraph(ctx, textForDisplay(fields.headline, fields.headlineUppercase), { ...t.headline, y: headlineY }, {
    fontFamily: t.headline.fontFamily,
    fontWeight: t.headline.fontWeight,
    fontSize: fields.headlineFontSize,
    minFontSize: t.headline.minFontSize,
    lineHeight: t.headline.lineHeight,
    color: t.headline.color,
  });
  drawCenteredParagraph(ctx, textForDisplay(fields.bodyText, fields.bodyUppercase), { ...t.bodyText, y: bodyY }, {
    fontFamily: t.bodyText.fontFamily,
    fontWeight: t.bodyText.fontWeight,
    fontSize: fields.bodyFontSize,
    minFontSize: t.bodyText.minFontSize,
    lineHeight: t.bodyText.lineHeight,
    color: t.bodyText.color,
    letterSpacing: t.bodyText.letterSpacing,
  });
}

function drawHeadlineVariant(
  ctx: CanvasRenderingContext2D,
  fields: SmPostFields,
  assets: PreparedAssets,
  media: HTMLImageElement | HTMLVideoElement | null,
  variant: typeof SM_POST_VARIANTS['7'] | typeof SM_POST_VARIANTS['8'],
) {
  ctx.fillStyle = variant.background;
  ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
  if (media) drawCoverClipped(ctx, media, variant.media, fields.imageScale, fields.imageOffsetX, fields.imageOffsetY);
  if (fields.noiseEnabled) drawNoise(ctx, fields.noiseIntensity, fields.noiseSize);
  drawLogos(ctx, fields, assets, variant.logoFg, variant.logoSecondary);
  drawCenteredParagraph(ctx, textForDisplay(fields.headline, fields.headlineUppercase), variant.headline, {
    fontFamily: '"Vina Sans", sans-serif',
    fontWeight: 400,
    fontSize: fields.headlineFontSize,
    minFontSize: variant.headline.minFontSize,
    lineHeight: variant.headline.lineHeight,
    color: variant.headline.color,
  });
}

function drawTemplate9(
  ctx: CanvasRenderingContext2D,
  fields: SmPostFields,
  assets: PreparedAssets,
  media: HTMLImageElement | HTMLVideoElement | null,
) {
  const t = SM_POST_VARIANTS['9'];
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
  if (media) drawCoverClipped(ctx, media, t.media, fields.imageScale, fields.imageOffsetX, fields.imageOffsetY);
  if (fields.noiseEnabled) drawNoise(ctx, fields.noiseIntensity, fields.noiseSize);

  ctx.fillStyle = t.copyCard.color;
  roundedRectPath(ctx, t.copyCard, t.copyCard.radius);
  ctx.fill();

  drawCenteredParagraph(ctx, textForDisplay(fields.tag, fields.tagUppercase), t.handle, {
    fontFamily: t.handle.fontFamily,
    fontWeight: t.handle.fontWeight,
    fontSize: t.handle.fontSize,
    minFontSize: t.handle.minFontSize,
    lineHeight: t.handle.lineHeight,
    color: t.handle.color,
  });
  drawCenteredParagraph(ctx, textForDisplay(fields.bodyText, fields.bodyUppercase), t.copy, {
    fontFamily: t.copy.fontFamily,
    fontWeight: t.copy.fontWeight,
    fontSize: fields.bodyFontSize,
    minFontSize: t.copy.minFontSize,
    lineHeight: t.copy.lineHeight,
    color: t.copy.color,
  });
  drawLogos(ctx, fields, assets, t.logoFg, t.logoSecondary);
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  fields: SmPostFields,
  assets: PreparedAssets,
  media: HTMLImageElement | HTMLVideoElement | null,
) {
  ctx.clearRect(0, 0, POST_WIDTH, POST_HEIGHT);
  switch (fields.templateId) {
    case '7': drawHeadlineVariant(ctx, fields, assets, media, SM_POST_VARIANTS['7']); break;
    case '8': drawHeadlineVariant(ctx, fields, assets, media, SM_POST_VARIANTS['8']); break;
    case '9': drawTemplate9(ctx, fields, assets, media); break;
    default: drawTemplate1(ctx, fields, assets, media); break;
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
    if (Math.abs(video.currentTime - safeTarget) < 0.002 && video.readyState >= 2) { resolve(); return; }
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
    try { video.currentTime = safeTarget; } catch { cleanup(); resolve(); }
  });
}

class GifWriter {
  private bytes: number[] = [];
  byte(value: number) { this.bytes.push(value & 255); }
  word(value: number) { this.byte(value); this.byte(value >> 8); }
  ascii(value: string) { for (let i = 0; i < value.length; i++) this.byte(value.charCodeAt(i)); }
  block(data: Uint8Array) {
    for (let offset = 0; offset < data.length; offset += 255) {
      const size = Math.min(255, data.length - offset);
      this.byte(size);
      for (let i = 0; i < size; i++) this.byte(data[offset + i]);
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
      const i = pixel * 4;
      const d = (bayer[(y & 3) * 4 + (x & 3)] - 7.5) * 1.4;
      const r = Math.max(0, Math.min(255, data[i] + d));
      const g = Math.max(0, Math.min(255, data[i + 1] + d));
      const b = Math.max(0, Math.min(255, data[i + 2] + d));
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
    for (let i = 1; i < indices.length; i++) {
      const symbol = indices[i];
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
  if (duration > GIF_MAX_DURATION) throw new Error(`Para manter o arquivo viável, o GIF aceita vídeos de até ${GIF_MAX_DURATION}s.`);

  const assets = await prepareAssets();
  const full = makeCanvas();
  const fullCtx = full.getContext('2d');
  const staging = makeCanvas(GIF_WIDTH, GIF_HEIGHT);
  const stagingCtx = staging.getContext('2d', { willReadFrequently: true });
  if (!fullCtx || !stagingCtx) throw new Error('Canvas indisponível neste navegador.');

  const writer = new GifWriter();
  createGifHeader(writer, GIF_WIDTH, GIF_HEIGHT);
  const totalFrames = Math.max(1, Math.ceil(duration * GIF_FPS));
  const delayCs = Math.max(2, Math.round(100 / GIF_FPS));

  for (let frame = 0; frame < totalFrames; frame++) {
    await waitForSeek(video, frame / GIF_FPS);
    drawScene(fullCtx, fields, assets, video);
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

function supportedMp4MimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

async function buildMp4(fields: SmPostFields, src: string, onProgress?: ExportProgress) {
  const mimeType = supportedMp4MimeType();
  if (!mimeType) throw new Error('Este navegador não oferece gravação MP4/H.264. Use uma versão atual do Chrome ou Edge.');

  const video = createVideo(src, false);
  await waitForVideo(video);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration) throw new Error('Não foi possível identificar a duração do vídeo.');

  const assets = await prepareAssets();
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof canvas.captureStream !== 'function') throw new Error('Seu navegador não oferece exportação de vídeo pelo canvas.');

  video.currentTime = 0;
  await waitForSeek(video, 0);
  drawScene(ctx, fields, assets, video);

  const stream = canvas.captureStream(MP4_FPS);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10_000_000 });
  recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });

  let raf = 0;
  let progressTimer: ReturnType<typeof setInterval> | undefined;
  const paint = () => {
    drawScene(ctx, fields, assets, video);
    if (!video.ended) raf = requestAnimationFrame(paint);
  };

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(), { once: true });
    recorder.addEventListener('error', () => reject(new Error('O navegador interrompeu a exportação MP4.')), { once: true });
  });

  try {
    recorder.start(500);
    raf = requestAnimationFrame(paint);
    progressTimer = setInterval(() => onProgress?.(Math.min(0.99, video.currentTime / duration)), 150);
    await video.play();
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('ended', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('Falha ao reproduzir o vídeo durante a exportação.')), { once: true });
    });
    drawScene(ctx, fields, assets, video);
    recorder.stop();
    await stopped;
    onProgress?.(1);
  } finally {
    cancelAnimationFrame(raf);
    if (progressTimer) clearInterval(progressTimer);
    for (const track of stream.getTracks()) track.stop();
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  return new Blob(chunks, { type: 'video/mp4' });
}

const SmPostCanvas = forwardRef<SmPostCanvasHandle, { fields: SmPostFields; onError: (message: string) => void }>(
  function SmPostCanvas({ fields, onError }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fieldsRef = useRef(fields);
    const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
    const assetsRef = useRef<PreparedAssets | null>(null);
    const rafRef = useRef(0);
    fieldsRef.current = fields;

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
      prepareAssets().then((assets) => {
        if (cancelled) return;
        assetsRef.current = assets;
        paintVisible();
      }).catch(() => { if (!cancelled) onError('Não foi possível carregar os logos ou fontes do post.'); });
      return () => { cancelled = true; };
    }, [onError]);

    useEffect(() => { paintVisible(); }, [fields]);

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
          paintVisible();
          return;
        }
        try {
          if (fields.mediaType === 'image') {
            const img = await loadImage(fields.imageUrl);
            if (cancelled) return;
            mediaRef.current = img;
            paintVisible();
            onError('');
            return;
          }
          const video = createVideo(fields.imageUrl, true);
          await waitForVideo(video);
          if (cancelled) return;
          mediaRef.current = video;
          const tick = () => {
            if (cancelled) return;
            paintVisible();
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
          video.play().catch(() => { /* first decoded frame remains available */ });
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
    }, [fields.imageUrl, fields.mediaType, onError]);

    useImperativeHandle(ref, () => ({
      exportPng: async () => {
        const assets = await prepareAssets();
        const buffer = makeCanvas();
        const context = buffer.getContext('2d');
        if (!context) throw new Error('Canvas indisponível neste navegador.');
        drawScene(context, fieldsRef.current, assets, mediaRef.current);
        return canvasToBlob(buffer, 'image/png');
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
    }));

    return <canvas ref={canvasRef} width={POST_WIDTH} height={POST_HEIGHT} className="sm-post-canvas" aria-label="Prévia do post" />;
  },
);

export default SmPostCanvas;
