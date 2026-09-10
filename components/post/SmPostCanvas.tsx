'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { POST_HEIGHT, POST_WIDTH, SM_POST_TEMPLATE, type SmPostFields } from '@/lib/smPostTemplate';

export type SmPostCanvasHandle = {
  exportPng: () => Promise<Blob | null>;
};

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
  box: { x: number; y: number; width: number; height: number },
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
  const widths = [...line].map((ch) => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, line.length - 1);
  let x = centerX - totalWidth / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  [...line].forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + spacing; });
  ctx.textAlign = prevAlign;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  scaleMultiplier = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const coverScale = Math.max(box.width / img.width, box.height / img.height);
  const scale = coverScale * scaleMultiplier;
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = box.x + (box.width - drawW) / 2 + offsetX;
  const dy = box.y + (box.height - drawH) / 2 + offsetY;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

function drawNoise(ctx: CanvasRenderingContext2D, intensity: number) {
  if (intensity <= 0) return;
  const w = 180;
  const h = 240;
  const noise = document.createElement('canvas');
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
  ctx.save();
  ctx.globalAlpha = (intensity / 100) * 0.22;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, POST_WIDTH, POST_HEIGHT);
  ctx.restore();
}

async function draw(ctx: CanvasRenderingContext2D, fields: SmPostFields) {
  const t = SM_POST_TEMPLATE;
  ctx.clearRect(0, 0, POST_WIDTH, POST_HEIGHT);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);

  if (fields.imageUrl) {
    try {
      const img = await loadImage(fields.imageUrl);
      drawCover(ctx, img, t.image, fields.imageScale, fields.imageOffsetX, fields.imageOffsetY);
    } catch {
      throw new Error('Não foi possível carregar a imagem. Envie outro arquivo.');
    }
  }

  const grad = ctx.createLinearGradient(0, t.shadow.y, 0, t.shadow.y + t.shadow.height);
  for (const stop of t.shadow.stops) grad.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = grad;
  ctx.fillRect(t.shadow.x, t.shadow.y, t.shadow.width, t.shadow.height);

  drawNoise(ctx, fields.noiseIntensity);

  try {
    const logoFg = await loadImage(t.logoFg.src);
    ctx.drawImage(logoFg, t.logoFg.x, t.logoFg.y, t.logoFg.width, t.logoFg.height);
    const logoSecondary = await loadImage(t.logoSecondary.src);
    ctx.drawImage(logoSecondary, t.logoSecondary.x, t.logoSecondary.y, t.logoSecondary.width, t.logoSecondary.height);
  } catch {
    throw new Error('Não foi possível carregar os logos do post.');
  }

  const tagCfg = t.tag;
  ctx.font = `${tagCfg.fontWeight} ${tagCfg.fontSize}px ${tagCfg.fontFamily}`;
  const tagText = fields.tag;
  const textWidth = [...tagText].reduce((sum, ch) => sum + ctx.measureText(ch).width + tagCfg.letterSpacing, -tagCfg.letterSpacing);
  const pillWidth = textWidth + tagCfg.paddingX * 2;
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

  drawCenteredParagraph(ctx, fields.headline, { ...t.headline, y: headlineY }, {
    fontFamily: t.headline.fontFamily,
    fontWeight: t.headline.fontWeight,
    fontSize: fields.headlineFontSize,
    minFontSize: t.headline.minFontSize,
    lineHeight: t.headline.lineHeight,
    color: t.headline.color,
  });

  drawCenteredParagraph(ctx, fields.bodyText, { ...t.bodyText, y: bodyY }, {
    fontFamily: t.bodyText.fontFamily,
    fontWeight: t.bodyText.fontWeight,
    fontSize: fields.bodyFontSize,
    minFontSize: t.bodyText.minFontSize,
    lineHeight: t.bodyText.lineHeight,
    color: t.bodyText.color,
    letterSpacing: t.bodyText.letterSpacing,
  });
}

async function renderPost(fields: SmPostFields) {
  await Promise.all([
    document.fonts.load('400 104px "Vina Sans"'),
    document.fonts.load('400 24px "Noto Sans"'),
    document.fonts.load('700 24px "Noto Sans"'),
  ]);
  const buffer = document.createElement('canvas');
  buffer.width = POST_WIDTH;
  buffer.height = POST_HEIGHT;
  const context = buffer.getContext('2d');
  if (!context) throw new Error('Canvas indisponível neste navegador.');
  await draw(context, fields);
  return buffer;
}

const SmPostCanvas = forwardRef<SmPostCanvasHandle, { fields: SmPostFields; onError: (message: string) => void }>(
  function SmPostCanvas({ fields, onError }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let cancelled = false;
      renderPost(fields).then((buffer) => {
        if (!cancelled) {
          canvas.getContext('2d')?.drawImage(buffer, 0, 0);
          onError('');
        }
      }).catch((error) => { if (!cancelled) onError(error.message); });
      return () => { cancelled = true; };
    }, [fields, onError]);

    useImperativeHandle(ref, () => ({
      exportPng: async () => {
        const buffer = await renderPost(fields);
        return new Promise<Blob | null>((resolve, reject) =>
          buffer.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG.')), 'image/png'),
        );
      },
    }));

    return <canvas ref={canvasRef} width={POST_WIDTH} height={POST_HEIGHT} className="sm-post-canvas" aria-label="Prévia do post" />;
  },
);

export default SmPostCanvas;
