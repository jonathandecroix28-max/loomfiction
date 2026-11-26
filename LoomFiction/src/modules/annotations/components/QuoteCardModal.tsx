import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../../components/feedback/FeedbackProvider';
import { IconClose } from '../../../components/icons';
import { stopBubbling } from '../utils/stopBubbling';
import {
  QUOTE_FORMATS,
  QUOTE_STYLES,
  renderQuoteCard,
  type QuoteFormat,
  type QuoteStyle,
} from './QuoteCardRenderer';

interface QuoteCardModalProps {
  quote: string;
  bookTitle: string;
  chapterTitle?: string;
  authorName?: string;
  onClose: () => void;
}

interface Prefs {
  format: QuoteFormat;
  style: QuoteStyle;
  showBrand: boolean;
}

interface Rendered {
  key: string;
  blob: Blob;
  truncated: boolean;
}

const PREFS_KEY = 'loomfiction:quote-card-prefs';
const DEFAULT_PREFS: Prefs = { format: 'portrait', style: 'dusk', showBrand: true };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      format: parsed.format && parsed.format in QUOTE_FORMATS ? parsed.format : DEFAULT_PREFS.format,
      style: parsed.style && parsed.style in QUOTE_STYLES ? parsed.style : DEFAULT_PREFS.style,
      showBrand: parsed.showBrand ?? DEFAULT_PREFS.showBrand,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'citation';

const FORMAT_KEYS = Object.keys(QUOTE_FORMATS) as QuoteFormat[];
const STYLE_KEYS = Object.keys(QUOTE_STYLES) as QuoteStyle[];

export function QuoteCardModal({ quote, bookTitle, chapterTitle, authorName, onClose }: QuoteCardModalProps) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [rendered, setRendered] = useState<Rendered | null>(null);

  const { format, style, showBrand } = prefs;
  const renderKey = [quote, bookTitle, chapterTitle ?? '', authorName ?? '', format, style, showBrand].join('\u0001');
  const ready = rendered?.key === renderKey ? rendered : null;
  const fileName = `${slugify(bookTitle)}-citation.png`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const changePrefs = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // préférences non mémorisées : sans gravité
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    void (async () => {
      try {
        const { truncated } = await renderQuoteCard(canvas, {
          quote,
          bookTitle,
          chapterTitle,
          authorName,
          format,
          style,
          showBrand,
          isCancelled: () => cancelled,
        });
        if (cancelled) return;
        canvas.toBlob((blob) => {
          if (!cancelled && blob) setRendered({ key: renderKey, blob, truncated });
        }, 'image/png');
      } catch (error) {
        console.error('Erreur lors de la création de la carte de citation :', error);
        if (!cancelled) toast.error('Impossible de créer la carte.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quote, bookTitle, chapterTitle, authorName, format, style, showBrand, renderKey, toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = () => {
    if (!ready) return;
    const url = URL.createObjectURL(ready.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Image téléchargée');
  };

  const share = async () => {
    if (!ready) return;
    const file = new File([ready.blob], fileName, { type: 'image/png' });

    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: bookTitle });
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') toast.error('Le partage a échoué.');
      }
      return;
    }
    download();
  };

  const copyImage = async () => {
    if (!ready) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': ready.blob })]);
      toast.success('Image copiée');
    } catch {
      toast.error('Copie de l’image impossible sur ce navigateur : utilisez Télécharger.');
    }
  };

  const segment = (active: boolean) =>
    `min-h-11 flex-1 cursor-pointer rounded-lg px-3 py-2 font-sans text-sm font-medium transition-colors ${
      active ? 'bg-amber-700 text-amber-50 shadow-sm' : 'text-amber-200/70 hover:text-amber-100'
    }`;

  const secondary =
    'min-h-11 flex-1 cursor-pointer rounded-xl border border-amber-900/30 bg-neutral-900 px-4 py-2 font-sans text-sm font-medium text-amber-200 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50';

  return createPortal(
    <div
      {...stopBubbling}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-card-title"
        className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-amber-900/40 bg-neutral-950 text-amber-100 shadow-2xl animate-[toast-in_180ms_ease-out] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-900/30 px-5 py-3">
          <h2 id="quote-card-title" className="font-serif text-lg font-bold">
            Carte de citation
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-amber-200/60 transition hover:bg-neutral-900 hover:text-amber-100"
          >
            <IconClose className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto overscroll-contain p-5 md:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="flex items-center justify-center rounded-2xl bg-neutral-900/60 p-3">
            <canvas
              ref={canvasRef}
              aria-label="Aperçu de la carte de citation"
              className="h-auto max-h-[52dvh] w-auto max-w-full rounded-lg shadow-2xl md:max-h-[64dvh]"
            />
          </div>

          <div className="space-y-5 font-sans">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200/60">Format</p>
              <div className="flex gap-1 rounded-xl border border-amber-900/30 bg-neutral-950/50 p-1">
                {FORMAT_KEYS.map((key) => (
                  <button key={key} type="button" aria-pressed={format === key} onClick={() => changePrefs({ format: key })} className={segment(format === key)}>
                    {QUOTE_FORMATS[key].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-amber-200/50">{QUOTE_FORMATS[format].hint}</p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200/60">Ambiance</p>
              <div className="grid grid-cols-4 gap-2 md:grid-cols-2">
                {STYLE_KEYS.map((key) => {
                  const palette = QUOTE_STYLES[key];
                  const active = style === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => changePrefs({ style: key })}
                      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition ${
                        active ? 'border-amber-600 bg-amber-900/40' : 'border-amber-900/30 hover:border-amber-700/60'
                      }`}
                    >
                      <span
                        className="h-10 w-full rounded-lg border border-black/20"
                        style={{ background: `linear-gradient(160deg, ${palette.bgTop}, ${palette.bgBottom})`, boxShadow: `inset 0 0 0 3px ${palette.bgTop}, inset 0 0 0 4px ${palette.accent}` }}
                      />
                      <span className="text-amber-200">{palette.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-amber-200/80">
              <input type="checkbox" checked={showBrand} onChange={(event) => changePrefs({ showBrand: event.target.checked })} className="size-5" />
              Signature LoomFiction
            </label>

            {ready?.truncated && <p className="rounded-xl border border-amber-900/30 bg-neutral-900/60 px-3 py-2 text-xs text-amber-200/80">Citation raccourcie pour tenir sur la carte.</p>}

            <div className="space-y-2">
              <button
                type="button"
                disabled={!ready}
                onClick={canShare ? () => void share() : download}
                className="min-h-12 w-full cursor-pointer rounded-xl bg-amber-700 px-5 font-sans text-sm font-semibold text-amber-50 shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!ready ? 'Préparation…' : canShare ? 'Partager' : 'Télécharger l’image'}
              </button>
              <div className="flex gap-2">
                <button type="button" disabled={!ready} onClick={() => void copyImage()} className={secondary}>
                  Copier l’image
                </button>
                {canShare && (
                  <button type="button" disabled={!ready} onClick={download} className={secondary}>
                    Télécharger
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}