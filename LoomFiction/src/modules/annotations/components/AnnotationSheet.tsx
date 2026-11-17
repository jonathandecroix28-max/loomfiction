import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconBack, IconClose, IconCopy, IconDelete, IconNext } from '../../../components/icons';
import { stopBubbling } from '../utils/stopBubbling';
import { HIGHLIGHT_COLORS, swatchOf, type Annotation, type HighlightColor } from '../utils/types';
import type { AnnotationPatch } from '../hooks/useAnnotations';

interface AnnotationSheetProps {
  annotation: Annotation;
  autoFocusNote: boolean;
  onChange: (patch: AnnotationPatch) => void;
  onDelete: () => void;
  onQuoteCard: () => void;
  onCopy: () => void;
  onClose: () => void;
  noteNumber?: number;
  position?: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
}

export function AnnotationSheet({
  annotation,
  autoFocusNote,
  onChange,
  onDelete,
  onQuoteCard,
  onCopy,
  onClose,
  noteNumber,
  position,
  onPrev,
  onNext,
}: AnnotationSheetProps) {
  const [draft, setDraft] = useState(annotation.note);

  const commit = () => {
    if (draft.trim() !== annotation.note.trim()) onChange({ note: draft.trim() });
  };

  const close = () => {
    commit();
    onClose();
  };

  const go = (target?: () => void) => {
    if (!target) return;
    commit();
    target();
  };

  const navBtn =
    'flex size-10 cursor-pointer items-center justify-center rounded-lg text-amber-200/70 transition hover:bg-neutral-900 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-30';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const secondary =
    'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-900/30 bg-neutral-900 px-3 py-2 font-sans text-sm font-medium text-amber-200 transition hover:bg-neutral-800';

  return createPortal(
    <div
      {...stopBubbling}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Annotation"
        className="max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto overscroll-contain rounded-t-3xl border border-amber-900/40 bg-neutral-950 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-amber-100 shadow-2xl animate-[toast-in_180ms_ease-out] sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-serif text-lg font-bold">
            Annotation{noteNumber !== undefined ? ` · note ${noteNumber}` : ''}
          </h2>

          <div className="flex shrink-0 items-center gap-0.5">
            {position && (
              <>
                <button type="button" disabled={!onPrev} onClick={() => go(onPrev)} aria-label="Annotation précédente" className={navBtn}>
                  <IconBack className="size-5" aria-hidden="true" />
                </button>
                <span className="min-w-10 text-center font-sans text-xs tabular-nums text-amber-200/60" aria-live="polite">
                  {position.index}/{position.total}
                </span>
                <button type="button" disabled={!onNext} onClick={() => go(onNext)} aria-label="Annotation suivante" className={navBtn}>
                  <IconNext className="size-5" aria-hidden="true" />
                </button>
              </>
            )}
            <button type="button" onClick={close} aria-label="Fermer" className={navBtn}>
              <IconClose className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <blockquote
          className="line-clamp-5 border-l-4 pl-3 font-serif text-sm italic leading-relaxed text-amber-100/90"
          style={{ borderColor: swatchOf(annotation.color) }}
        >
          {annotation.quote}
        </blockquote>

        <div role="radiogroup" aria-label="Couleur du surlignage" className="flex items-center gap-2">
          {HIGHLIGHT_COLORS.map((color) => {
            const active = color.key === annotation.color;
            return (
              <button
                key={color.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={color.label}
                onClick={() => onChange({ color: color.key as HighlightColor })}
                className={`flex size-11 cursor-pointer items-center justify-center rounded-full transition ${
                  active ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-neutral-950' : 'hover:bg-neutral-900'
                }`}
              >
                <span className="size-7 rounded-full border border-black/20" style={{ backgroundColor: color.swatch }} />
              </button>
            );
          })}
        </div>

        <div>
          <label htmlFor="annotation-note" className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-wider text-amber-200/60">
            Note de marge
          </label>
          <textarea
            id="annotation-note"
            value={draft}
            autoFocus={autoFocusNote}
            rows={4}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            placeholder="Une pensée, une piste, un rappel…"
            className="w-full resize-y rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-3 font-serif text-base leading-relaxed text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:text-sm"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onQuoteCard} className={secondary}>
            Carte de citation
          </button>
          <button type="button" onClick={onCopy} className={secondary} aria-label="Copier la citation">
            <IconCopy className="size-4" aria-hidden="true" />
            Copier
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-amber-900/30 pt-4">
          <button
            type="button"
            onClick={onDelete}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-red-900/30 bg-red-950/50 px-3.5 font-sans text-sm font-medium text-red-300 transition hover:bg-red-900/80"
          >
            <IconDelete className="size-4" aria-hidden="true" />
            Supprimer
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-11 cursor-pointer rounded-xl bg-amber-700 px-6 font-sans text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600"
          >
            Terminé
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}