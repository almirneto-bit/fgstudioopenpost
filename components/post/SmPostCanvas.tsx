'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { POST_HEIGHT, POST_WIDTH, SM_POST_TEMPLATE, type SmPostFields } from '@/lib/smPostTemplate';

export type SmPostCanvasHandle = {
  exportPng: () => Promise<Blob | null>;
};

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCenteredParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; width: number; height: number },
  opts: {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    lineHeight: number;
    color: string;
    letterSpacing?: number;
    uppercase?: boolean;
  },
) {
  const content = opts.uppercase ? text.toUpperCase() : text;
  ctx.font = `${opts.fontWeight} ${opts.fontSize}px ${opts.fontFamily}`;
  ctx.fillStyle = opts.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Canvas 2D has no native letter-spacing pre-Safari18; approximate for
  // wrapping purposes only (visual spacing is close enough at these sizes).
  const lines = wrapLines(ctx, content, box.width);
  const lineHeightPx = opts.fontSize * opts.lineHeight;
  const totalHeight = lines.length * lineHeightPx;
  let cursorY = box.y + box.height / 2 - totalHeight / 2 + lineHeightPx / 2;
  const centerX = box.x + box.width / 2;
  for (const line of lines) {
    if ((opts.letterSpacing ?? 0) > 0) {
      drawLetterSpaced(ctx, line, centerX, cursorY, opts.letterSpacing!);
    } else {
      ctx.fillText(line, centerX, cursorY);
    }
    cursorY += lineHeightPx;
  }
}

function drawLetterSpaced(
  ctx: CanvasRenderingContext2D,
  line: string,
  centerX: number,
  y: number,
  spacing: number,
) {
  const widths = [...line].map((ch) => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * (line.length - 1);
  let x = centerX - totalWidth / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  [...line].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
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
) {
  const scale = Math.max(box.width / img.width, box.height / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = box.x + (box.width - drawW) / 2;
  const dy = box.y + (box.height - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

async function draw(ctx: CanvasRenderingContext2D, fields: SmPostFields) {
  const t = SM_POST_TEMPLATE;
  ctx.clearRect(0, 0, POST_WIDTH, POST_HEIGHT);

  // 1. Imagem de fundo (editável)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
  if (fields.imageUrl) {
    try {
      const img = await loadImage(fields.imageUrl);
      drawCover(ctx, img, t.image);
    } catch {
      // sem imagem carregável ainda — mantém o placeholder escuro
    }
  }

  // 2. Shadow (fixo)
  const grad = ctx.createLinearGradient(0, t.shadow.y, 0, t.shadow.y + t.shadow.height);
  for (const stop of t.shadow.stops) grad.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = grad;
  ctx.fillRect(t.shadow.x, t.shadow.y, t.shadow.width, t.shadow.height);

  // 3. Logos (fixos)
  try {
    const logoFg = await loadImage(t.logoFg.src);
    ctx.drawImage(logoFg, t.logoFg.x, t.logoFg.y, t.logoFg.width, t.logoFg.height);
  } catch {
    /* asset ainda não adicionado em public/post/ */
  }
  try {
    const logoSecondary = await loadImage(t.logoSecondary.src);
    ctx.drawImage(logoSecondary, t.logoSecondary.x, t.logoSecondary.y, t.logoSecondary.width, t.logoSecondary.height);
  } catch {
    /* asset ainda não adicionado em public/post/ */
  }

  // 4. Tag (editável)
  const tagCfg = t.tag;
  ctx.font = `${tagCfg.fontWeight} ${tagCfg.fontSize}px ${tagCfg.fontFamily}`;
  const tagText = fields.tag.toUpperCase();
  const textWidth = [...tagText].reduce(
    (sum, ch) => sum + ctx.measureText(ch).width + tagCfg.letterSpacing,
    -tagCfg.letterSpacing,
  );
  const pillWidth = textWidth + tagCfg.paddingX * 2;
  const pillHeight = tagCfg.height;
  const pillX = tagCfg.centerX - pillWidth / 2;
  const pillY = tagCfg.y;
  ctx.fillStyle = tagCfg.background;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, tagCfg.cornerRadius);
  ctx.fill();
  ctx.fillStyle = tagCfg.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawLetterSpaced(ctx, tagText, tagCfg.centerX, pillY + pillHeight / 2 + 1, tagCfg.letterSpacing);

  // 5. Headline (editável)
  drawCenteredParagraph(ctx, fields.headline, t.headline, {
    fontFamily: t.headline.fontFamily,
    fontWeight: t.headline.fontWeight,
    fontSize: t.headline.fontSize,
    lineHeight: t.headline.lineHeight,
    color: t.headline.color,
    uppercase: t.headline.uppercase,
  });

  // 6. Body text (editável)
  drawCenteredParagraph(ctx, fields.bodyText, t.bodyText, {
    fontFamily: t.bodyText.fontFamily,
    fontWeight: t.bodyText.fontWeight,
    fontSize: t.bodyText.fontSize,
    lineHeight: t.bodyText.lineHeight,
    color: t.bodyText.color,
    letterSpacing: t.bodyText.letterSpacing,
  });
}

const SmPostCanvas = forwardRef<SmPostCanvasHandle, { fields: SmPostFields }>(
  function SmPostCanvas({ fields }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      let cancelled = false;
      // Garante que Vina Sans / Noto Sans estejam carregadas antes de medir texto.
      document.fonts.ready.then(() => {
        if (!cancelled) void draw(ctx, fields);
      });
      return () => {
        cancelled = true;
      };
    }, [fields]);

    useImperativeHandle(ref, () => ({
      exportPng: () =>
        new Promise((resolve) => {
          canvasRef.current?.toBlob((blob) => resolve(blob), 'image/png', 1);
        }),
    }));

    return (
      <canvas
        ref={canvasRef}
        width={POST_WIDTH}
        height={POST_HEIGHT}
        className="sm-post-canvas"
        aria-label="Prévia do post"
      />
    );
  },
);

export default SmPostCanvas;
