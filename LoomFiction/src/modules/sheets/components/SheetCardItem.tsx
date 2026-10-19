
import type { IdeaResponse } from '../../../types/idea';

interface SheetCardItemProps {
  card: IdeaResponse;
  index: number;
  total: number;
  onMove: (index: number, delta: -1 | 1) => void;
  onEdit: (card: IdeaResponse) => void;
  onVersions: (card: IdeaResponse) => void;
  onDelete: (card: IdeaResponse) => void;
}

const btn =
  'flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 sm:min-h-9 sm:py-1.5';

export function SheetCardItem({
  card,
  index,
  total,
  onMove,
  onEdit,
  onVersions,
  onDelete,
}: SheetCardItemProps) {
  const hasText = !!card.description?.trim();

  return (
    <div className="rounded-2xl border border-amber-900/25 bg-neutral-950/70 p-4 shadow-xl sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="min-w-0 break-words font-serif text-xl font-bold text-amber-100">
          {card.name}
        </h3>

        <div className="grid w-full grid-cols-5 gap-2 font-sans sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center">
          <button
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            aria-label="Monter la carte"
            title="Monter"
            className={`${btn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <span aria-hidden="true" className="text-base">↑</span>
            <span className="hidden sm:inline">Monter</span>
          </button>

          <button
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label="Descendre la carte"
            title="Descendre"
            className={`${btn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <span aria-hidden="true" className="text-base">↓</span>
            <span className="hidden sm:inline">Descendre</span>
          </button>

          <button
            onClick={() => onVersions(card)}
            aria-label="Voir les versions"
            title="Versions"
            className={`${btn} border-amber-900/30 bg-amber-950/80 text-amber-200 hover:bg-amber-900`}
          >
            <span aria-hidden="true" className="text-base">↶</span>
            <span className="hidden sm:inline">Versions</span>
          </button>

          <button
            onClick={() => onEdit(card)}
            aria-label="Éditer la carte"
            title="Éditer"
            className={`${btn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <span aria-hidden="true" className="text-base">✎</span>
            <span className="hidden sm:inline">Éditer</span>
          </button>

          <button
            onClick={() => onDelete(card)}
            aria-label="Supprimer la carte"
            title="Supprimer"
            className={`${btn} border-red-900/30 bg-red-950/50 text-red-300 hover:bg-red-900/80`}
          >
            <span aria-hidden="true" className="text-base">🗑</span>
            <span className="hidden sm:inline">Supprimer</span>
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-amber-900/20 pt-3">
        {hasText ? (
          <div className="whitespace-pre-wrap break-words leading-relaxed text-amber-200/80">
            {card.description}
          </div>
        ) : (
          <button
            onClick={() => onEdit(card)}
            className="min-h-10 cursor-pointer italic text-amber-200/50 hover:text-amber-200/80"
          >
            À compléter… (toucher pour écrire)
          </button>
        )}
      </div>
    </div>
  );
}
