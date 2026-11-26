import { swatchOf, type Annotation } from '../utils/types';

export interface MarginNoteItem {
  annotation: Annotation;
  top: number;
}

interface MarginNotesProps {
  items: MarginNoteItem[];
  numbers?: Record<string, number>;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}

const GAP = 10;

const estimateHeight = (note: string) => 22 + Math.min(4, Math.max(1, Math.ceil(note.length / 30))) * 18;

function stack(items: MarginNoteItem[]) {
  let cursor = -Infinity;
  return [...items]
    .sort((a, b) => a.top - b.top)
    .map((item) => {
      const top = Math.max(item.top, cursor);
      cursor = top + estimateHeight(item.annotation.note) + GAP;
      return { ...item, top };
    });
}

export function MarginNotes({ items, numbers = {}, hoverId, onHover, onOpen }: MarginNotesProps) {
  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Notes de marge"
      className="pointer-events-none absolute left-full top-0 ml-6 hidden w-56 xl:block print:hidden"
    >
      {stack(items).map(({ annotation, top }) => {
        const active = hoverId === annotation.id;
        const number = numbers[annotation.id];
        return (
          <button
            key={annotation.id}
            type="button"
            onClick={() => onOpen(annotation.id)}
            onMouseEnter={() => onHover(annotation.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(annotation.id)}
            onBlur={() => onHover(null)}
            className={`pointer-events-auto absolute left-0 flex w-full cursor-pointer items-start gap-2 rounded-r-lg border-l-[3px] px-3 py-2 text-left transition-colors ${
              active ? 'bg-neutral-900' : 'bg-neutral-950/60 hover:bg-neutral-900'
            }`}
            style={{ top, borderColor: swatchOf(annotation.color) }}
          >
            {number !== undefined && (
              <span
                className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-amber-700 font-sans text-[10px] font-bold leading-none text-amber-50"
                aria-label={`Note ${number}`}
              >
                {number}
              </span>
            )}
            <span className="line-clamp-4 font-serif text-xs italic leading-[18px] text-amber-200/80">{annotation.note}</span>
          </button>
        );
      })}
    </aside>
  );
}