import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconEdit } from '../../../components/icons';
import { stopBubbling } from '../utils/stopBubbling';
import { swatchOf, type Annotation } from '../utils/types';

export interface NotesDrawerItem {
  annotation: Annotation;
  number?: number;
  missing?: boolean;
}

interface NotesDrawerProps {
  items: NotesDrawerItem[];
  onGo: (id: string) => void;
  onEdit: (id: string) => void;
  onClose: () => void;
}

export function IconNotes({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" />
      <path d="M8 8h8M8 11.5h5" />
    </svg>
  );
}

type Filter = 'all' | 'notes';

export function NotesDrawer({ items, onGo, onEdit, onClose }: NotesDrawerProps) {
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const withNote = items.filter((item) => item.annotation.note.trim()).length;
  const visible = filter === 'notes' ? items.filter((item) => item.annotation.note.trim()) : items;

  const chip = (active: boolean) =>
    `min-h-10 cursor-pointer rounded-full border px-4 text-sm font-medium transition ${
      active ? 'border-amber-600 bg-amber-700 text-amber-50' : 'border-amber-900/40 bg-neutral-900 text-amber-200 hover:bg-neutral-800'
    }`;

  return createPortal(
    <div
      {...stopBubbling}
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-drawer-title"
        className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-amber-900/40 bg-neutral-950 text-amber-100 shadow-2xl animate-[toast-in_180ms_ease-out] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-900/30 px-5 py-3">
          <h2 id="notes-drawer-title" className="font-serif text-lg font-bold">
            Annotations du chapitre
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

        <div className="flex shrink-0 gap-2 px-5 pt-3 font-sans">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={chip(filter === 'all')}>
            Tout · {items.length}
          </button>
          <button type="button" aria-pressed={filter === 'notes'} onClick={() => setFilter('notes')} className={chip(filter === 'notes')}>
            Avec une note · {withNote}
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {visible.length === 0 && (
            <li className="py-8 text-center font-serif text-sm text-amber-200/50">Aucune annotation avec une note pour le moment.</li>
          )}

          {visible.map(({ annotation, number, missing }) => (
            <li key={annotation.id} className="flex items-stretch gap-1 rounded-xl border border-amber-900/25 bg-neutral-900/60">
              <button
                type="button"
                onClick={() => onGo(annotation.id)}
                disabled={missing}
                aria-label={number ? `Aller à la note ${number}` : 'Aller au passage surligné'}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-l-xl p-3 text-left transition hover:bg-neutral-900 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-black/20 font-sans text-xs font-bold text-[#2a1507]"
                  style={{ backgroundColor: swatchOf(annotation.color) }}
                  aria-hidden="true"
                >
                  {number ?? ''}
                </span>

                <span className="min-w-0">
                  <span className="line-clamp-2 block font-serif text-sm italic leading-snug text-amber-100/90">«&nbsp;{annotation.quote}&nbsp;»</span>
                  {annotation.note.trim() && (
                    <span className="mt-1.5 line-clamp-4 block whitespace-pre-wrap font-serif text-sm leading-snug text-amber-200/90">
                      {annotation.note}
                    </span>
                  )}
                  {missing && (
                    <span className="mt-1.5 block font-sans text-xs text-amber-200/50">Passage introuvable dans le texte actuel</span>
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onEdit(annotation.id)}
                aria-label="Modifier l’annotation"
                title="Modifier"
                className="flex w-11 shrink-0 cursor-pointer items-center justify-center rounded-r-xl text-amber-200/60 transition hover:bg-neutral-900 hover:text-amber-100"
              >
                <IconEdit className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>,
    document.body,
  );
}