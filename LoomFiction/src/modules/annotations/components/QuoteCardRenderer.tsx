export type QuoteFormat = 'portrait' | 'square' | 'story';
export type QuoteStyle = 'dusk' | 'dawn' | 'parchment' | 'ink';

export const QUOTE_FORMATS: Record<QuoteFormat, { width: number; height: number; label: string; hint: string }> = {
  portrait: { width: 1080, height: 1350, label: 'Portrait', hint: '4:5 · Instagram, Facebook' },
  square: { width: 1080, height: 1080, label: 'Carré', hint: '1:1 · partout' },
  story: { width: 1080, height: 1920, label: 'Story', hint: '9:16 · Stories, TikTok' },
};

interface Palette {
  label: string;
  bgTop: string;
  bgBottom: string;
  glow: [number, number, number];
  glowAlpha: number;
  ink: string;
  muted: string;
  accent: string;
  frame: string;
  doubleFrame?: boolean;
  grain?: boolean;
}

export const QUOTE_STYLES: Record<QuoteStyle, Palette> = {
  dusk: {
    label: 'Crépuscule',
    bgTop: '#2b1a11',
    bgBottom: '#150c08',
    glow: [232, 110, 40],
    glowAlpha: 0.32,
    ink: '#ffeccb',
    muted: 'rgba(240,197,140,0.75)',
    accent: '#f59e3b',
    frame: 'rgba(245,158,59,0.38)',
  },
  dawn: {
    label: 'Aube',
    bgTop: '#fbe9c6',
    bgBottom: '#f0d39b',
    glow: [255, 170, 80],
    glowAlpha: 0.5,
    ink: '#2a1507',
    muted: 'rgba(90,50,18,0.8)',
    accent: '#b8420a',
    frame: 'rgba(184,66,10,0.38)',
  },
  parchment: {
    label: 'Parchemin',
    bgTop: '#f1e6cb',
    bgBottom: '#e3d2aa',
    glow: [120, 80, 30],
    glowAlpha: 0.12,
    ink: '#3a2816',
    muted: 'rgba(58,40,22,0.75)',
    accent: '#8a5a2b',
    frame: 'rgba(58,40,22,0.4)',
    grain: true,
  },
  ink: {
    label: 'Encre',
    bgTop: '#0e0c0b',
    bgBottom: '#050404',
    glow: [217, 179, 108],
    glowAlpha: 0.16,
    ink: '#f5ecd9',
    muted: 'rgba(245,236,217,0.65)',
    accent: '#d9b36c',
    frame: 'rgba(217,179,108,0.5)',
    doubleFrame: true,
  },
};

export interface QuoteCardOptions {
  quote: string;
  bookTitle: string;
  chapterTitle?: string;
  authorName?: string;
  format: QuoteFormat;
  style: QuoteStyle;
  showBrand: boolean;
  isCancelled?: () => boolean;
}

const BODY_FONT = '"Literata Variable", "Fraunces Variable", Georgia, "Times New Roman", serif';
const DISPLAY_FONT = '"Fraunces Variable", "Literata Variable", Georgia, "Times New Roman", serif';
const MAX_CHARS = 700;
const LINE_HEIGHT = 1.38;

async function ensureFonts() {
  if (!('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load('italic 400 48px "Literata Variable"'),
      document.fonts.load('400 30px "Literata Variable"'),
      document.fonts.load('700 48px "Fraunces Variable"'),
    ]);
  } catch {
    // Polices système en repli
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';

  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
      line = '';
    }

    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }

    let chunk = '';
    for (const char of word) {
      if (ctx.measureText(chunk + char).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    line = chunk;
  }

  if (line) lines.push(line);
  return lines;
}

function fitLine(ctx: CanvasRenderingContext2D, text: string, fontFor: (size: number) => string, maxSize: number, minSize: number, maxWidth: number) {
  let size = maxSize;
  ctx.font = fontFor(size);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = fontFor(size);
  }

  let fitted = text;
  while (fitted.length > 1 && ctx.measureText(fitted).width > maxWidth) {
    fitted = `${fitted.slice(0, -2).trimEnd()}…`;
  }
  return { text: fitted, size };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawOrnament(ctx: CanvasRenderingContext2D, cx: number, y: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 140, y);
  ctx.lineTo(cx - 26, y);
  ctx.moveTo(cx + 26, y);
  ctx.lineTo(cx + 140, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, y - 9);
  ctx.lineTo(cx + 9, y);
  ctx.lineTo(cx, y + 9);
  ctx.lineTo(cx - 9, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export async function renderQuoteCard(canvas: HTMLCanvasElement, options: QuoteCardOptions): Promise<{ truncated: boolean }> {
  const { format, style, showBrand } = options;
  const palette = QUOTE_STYLES[style];
  const { width: W, height: H } = QUOTE_FORMATS[format];

  await ensureFonts();
  if (options.isCancelled?.()) return { truncated: false };

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');

  // Fond
  const background = ctx.createLinearGradient(0, 0, 0, H);
  background.addColorStop(0, palette.bgTop);
  background.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  const [r, g, b] = palette.glow;
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.8);
  glow.addColorStop(0, `rgba(${r},${g},${b},${palette.glowAlpha})`);
  glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  if (palette.grain) {
    const random = mulberry32(1847);
    for (let i = 0; i < (W * H) / 650; i += 1) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(90,60,25,0.06)' : 'rgba(255,250,235,0.08)';
      ctx.fillRect(random() * W, random() * H, 1.6, 1.6);
    }
  }


  ctx.strokeStyle = palette.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 54, W - 108, H - 108);
  if (palette.doubleFrame) {
    ctx.lineWidth = 1;
    ctx.strokeRect(70, 70, W - 140, H - 140);
  }

  let text = options.quote.replace(/\s+/g, ' ').trim();
  let truncated = false;
  if (text.length > MAX_CHARS) {
    text = `${text.slice(0, MAX_CHARS).replace(/\s+\S*$/, '')}…`;
    truncated = true;
  }

  const padX = 130;
  const maxWidth = W - padX * 2;
  const markY = Math.round(H * 0.185);
  const regionTop = markY + 80;
  const regionBottom = H - 330;
  const regionHeight = regionBottom - regionTop;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.55;
  ctx.font = `700 200px ${DISPLAY_FONT}`;
  ctx.fillText('“', W / 2, markY + 110);
  ctx.globalAlpha = 1;

  const maxSize = format === 'story' ? 76 : format === 'square' ? 62 : 68;
  const minSize = 34;
  let size = maxSize;
  let lines: string[] = [];
  for (; size >= minSize; size -= 2) {
    ctx.font = `italic 400 ${size}px ${BODY_FONT}`;
    lines = wrapLines(ctx, text, maxWidth);
    if (lines.length * size * LINE_HEIGHT <= regionHeight) break;
  }
  size = Math.max(size, minSize);
  ctx.font = `italic 400 ${size}px ${BODY_FONT}`;

  const lineHeight = size * LINE_HEIGHT;
  const maxLines = Math.max(1, Math.floor(regionHeight / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[maxLines - 1] = `${last.replace(/[.,;:!?…]+$/, '')}…`;
    truncated = true;
  }

  const blockTop = regionTop + (regionHeight - lines.length * lineHeight) / 2;
  ctx.fillStyle = palette.ink;
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => ctx.fillText(line, W / 2, blockTop + lineHeight * (index + 0.5)));

  const footerY = H - 250;
  drawOrnament(ctx, W / 2, footerY, palette.accent);

  ctx.textBaseline = 'middle';
  const title = fitLine(ctx, options.bookTitle, (s) => `700 ${s}px ${DISPLAY_FONT}`, 46, 28, maxWidth);
  ctx.font = `700 ${title.size}px ${DISPLAY_FONT}`;
  ctx.fillStyle = palette.ink;
  ctx.fillText(title.text, W / 2, footerY + 62);

  const subtitleText = [options.chapterTitle, options.authorName].filter(Boolean).join('  ·  ');
  if (subtitleText) {
    const subtitle = fitLine(ctx, subtitleText, (s) => `400 ${s}px ${BODY_FONT}`, 30, 22, maxWidth);
    ctx.font = `400 ${subtitle.size}px ${BODY_FONT}`;
    ctx.fillStyle = palette.muted;
    ctx.fillText(subtitle.text, W / 2, footerY + 112);
  }

  if (showBrand) {
    const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    ctx.font = `600 20px ${BODY_FONT}`;
    ctx.fillStyle = palette.muted;
    ctx.globalAlpha = 0.7;
    if ('letterSpacing' in spaced) spaced.letterSpacing = '6px';
    ctx.fillText('LOOMFICTION', W / 2, H - 92);
    if ('letterSpacing' in spaced) spaced.letterSpacing = '0px';
    ctx.globalAlpha = 1;
  }

  return { truncated };
}