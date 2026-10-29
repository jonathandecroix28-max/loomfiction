import { useState } from 'react';
import type { IdeaResponse } from '../../../types/idea';

interface SheetCardItemProps {
  card: IdeaResponse;
  index: number;
  total: number;
  onMove: (index: number, delta: -1 | 1) => void;
  onEdit: (card: IdeaResponse) => void;
  onVersions: (card: IdeaResponse) => void;
  onDelete: (card: IdeaResponse) => void;
  onSaveDescription: (
    card: IdeaResponse,
    description: string,
  ) => Promise<boolean>;
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
  onSaveDescription,
}: SheetCardItemProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState(card.description || '');
  const [isSavingDescription, setIsSavingDescription] = useState(false);


  const [prevDescription, setPrevDescription] = useState(card.description);
  if (card.description !== prevDescription) {
    setPrevDescription(card.description);
    setDraftDescription(card.description || '');
  }

  const startEditing = () => {
    setDraftDescription(card.description || '');
    setIsEditingDescription(true);
  };

  const cancelEditing = () => {
    setDraftDescription(card.description || '');
    setIsEditingDescription(false);
  };

  const saveDescription = async () => {
    if (isSavingDescription) return;

    setIsSavingDescription(true);
    try {
      const saved = await onSaveDescription(card, draftDescription);
      if (saved) setIsEditingDescription(false);
    } finally {
      setIsSavingDescription(false);
    }
  };

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
        {isEditingDescription ? (
          <div className="space-y-3">
            <textarea
              autoFocus
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelEditing();
                }
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void saveDescription();
                }
              }}
              aria-label={`Modifier la description de ${card.name}`}
              placeholder="Écrire la description..."
              rows={5}
              className="min-h-32 w-full resize-y rounded-xl border border-amber-800/50 bg-neutral-900 px-3 py-3 font-sans text-sm leading-relaxed text-amber-100 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isSavingDescription}
                className="min-h-10 cursor-pointer rounded-lg border border-amber-900/30 px-4 py-2 text-sm text-amber-200/80 hover:bg-neutral-900 disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() => void saveDescription()}
                disabled={isSavingDescription}
                className="min-h-10 cursor-pointer rounded-lg border border-amber-700 bg-amber-800 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-700 disabled:cursor-wait disabled:opacity-50"
              >
                {isSavingDescription ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>

            <p className="text-xs text-amber-200/40">
              Astuce : Ctrl + Entrée pour enregistrer, Échap pour annuler.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            aria-label={`Toucher pour modifier la description de ${card.name}`}
            className="block min-h-10 w-full cursor-text rounded-lg text-left transition hover:bg-amber-950/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-700"
          >
            {card.description?.trim() ? (
              <span className="block whitespace-pre-wrap break-words py-1 leading-relaxed text-amber-200/80">
                {card.description}
              </span>
            ) : (
              <span className="block py-1 italic text-amber-200/50">
                À compléter… (toucher pour écrire)
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}