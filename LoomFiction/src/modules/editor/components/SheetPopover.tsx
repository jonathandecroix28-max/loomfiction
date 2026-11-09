import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import type { SheetResponse } from '../../../types/sheet';
import type { IdeaResponse } from '../../../types/idea';
import { IconSheet } from '../../../components/icons';

interface SheetPopoverProps {
  sheetId: number;
  onNavigate: (path: string) => void;
  /** Sur mobile, il n'y a pas de survol pour refermer : un bouton « Fermer » apparaît si cette fonction est fournie. */
  onClose?: () => void;
}


const sanitizeDescription = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['data-type', 'data-id', 'data-label'],
  });

export function SheetPopover({ sheetId, onNavigate, onClose }: SheetPopoverProps) {
  const [sheet, setSheet] = useState<SheetResponse | null>(null);
  const [cards, setCards] = useState<IdeaResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Autre fiche : on repasse en « chargement » (ajustement pendant le rendu, sans effet)
  const [prevSheetId, setPrevSheetId] = useState(sheetId);
  if (sheetId !== prevSheetId) {
    setPrevSheetId(sheetId);
    setLoading(true);
  }

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [loadedSheet, loadedCards] = await Promise.all([
          offlineSheetService.getById(sheetId),
          offlineIdeaService.getBySheetId(sheetId),
        ]);
        if (isMounted) {
          setSheet(loadedSheet ?? null);
          setCards(loadedCards);
        }
      } catch (err) {
        console.error('Erreur popover fiche :', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void loadData();
    return () => {
      isMounted = false;
    };
  }, [sheetId]);

  if (loading) {
    return (
      <div className="w-full max-w-[calc(100vw-1rem)] rounded-2xl border border-amber-900/40 bg-[#1c1411] p-4 font-serif text-xs text-amber-200/60 shadow-2xl sm:w-64">
        Chargement de la fiche…
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="w-full max-w-[calc(100vw-1rem)] rounded-2xl border border-red-900/40 bg-[#1c1411] p-4 font-serif text-xs text-red-300 shadow-2xl sm:w-64">
        Fiche introuvable.
      </div>
    );
  }

  const filledCards = cards.filter((c) => c.description?.trim()).slice(0, 2);

  return (
    <div className="max-h-[min(55dvh,32rem)] w-full max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-2xl border border-amber-900/50 bg-[#1c1411] p-4 font-sans text-amber-50 shadow-2xl backdrop-blur-md sm:max-h-none sm:w-72">
      <div className="flex items-center justify-between gap-3 border-b border-amber-900/30 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <IconSheet className="size-4 shrink-0 text-amber-400" aria-hidden="true" />
          <h4 className="truncate font-serif text-sm font-bold text-amber-100">{sheet.name}</h4>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate(`/ideas/fiches/${sheet.id}`)}
            className="min-h-10 cursor-pointer rounded-lg bg-amber-800/60 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-700 sm:min-h-9"
          >
            Ouvrir
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'aperçu de la fiche"
              className="min-h-10 min-w-10 cursor-pointer rounded-lg border border-amber-900/40 px-2 text-sm text-amber-200/70 transition hover:bg-neutral-900 sm:hidden"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {filledCards.length === 0 ? (
          <p className="font-serif text-xs italic text-amber-200/40">Aucune carte renseignée.</p>
        ) : (
          filledCards.map((card) => (
            <div key={card.id} className="rounded-lg border border-amber-900/20 bg-neutral-900/60 p-2 text-xs">
              {/* Le conteneur est un bloc (line-clamp ne fonctionne pas sur un <span>) et les paragraphes de la description restent en ligne */}
              <div className="line-clamp-3 sm:line-clamp-2">
                <span className="font-serif font-semibold text-amber-200">{card.name} : </span>
                <span
                  className="text-amber-100/80 [&_p]:inline"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeDescription(card.description ?? ''),
                  }}
                />
              </div>
            </div>
          ))
        )}
        {cards.length > 2 && (
          <p className="text-right font-serif text-[10px] text-amber-200/40">+ {cards.length - 2} autres cartes</p>
        )}
      </div>
    </div>
  );
}