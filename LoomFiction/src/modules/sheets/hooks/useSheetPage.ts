import { useCallback, useEffect, useState } from 'react';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineCategoryService } from '../../../services/offlineCategoryService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import type { SheetResponse } from '../../../types/sheet';
import type { CategoryResponse } from '../../../types/category';
import type { IdeaResponse } from '../../../types/idea';

type SheetPageState = {
  sheetId: number;
  sheet: SheetResponse | null;
  category: CategoryResponse | null;
  cards: IdeaResponse[];
  error: string | null;
};

async function fetchSheetPage(sheetId: number): Promise<SheetPageState> {
  try {
    const sheet = await offlineSheetService.getById(sheetId);
    const [category, cards] = await Promise.all([
      offlineCategoryService.getById(sheet.categoryId).catch(() => null),
      offlineIdeaService.getBySheetId(sheetId),
    ]);
    return { sheetId, sheet, category, cards, error: null };
  } catch (err) {
    console.error('Erreur lors du chargement de la fiche :', err);
    return { sheetId, sheet: null, category: null, cards: [], error: 'Impossible de charger cette fiche.' };
  }
}

export function useSheetPage(sheetId: number | null) {
  // Dernier état chargé. Pendant un changement de fiche, l'ancien reste affiché jusqu'à l'arrivée du nouveau
  // (pas d'écran de chargement qui démonterait l'explorateur) ; `sheet.id` indique à quelle fiche il appartient.
  const [state, setState] = useState<SheetPageState | null>(null);

  useEffect(() => {
    if (!sheetId) return;
    let cancelled = false;

    void fetchSheetPage(sheetId).then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, [sheetId]);

  // Rechargement silencieux : ne touche pas à `isLoading`, donc aucun écran de chargement.
  const reload = useCallback(async () => {
    if (!sheetId) return;
    const next = await fetchSheetPage(sheetId);
    setState((previous) => (previous && previous.sheetId !== sheetId ? previous : next));
  }, [sheetId]);

  const setCards = useCallback((update: IdeaResponse[] | ((current: IdeaResponse[]) => IdeaResponse[])) => {
    setState((previous) => {
      if (!previous) return previous;
      const cards = typeof update === 'function' ? update(previous.cards) : update;
      return { ...previous, cards };
    });
  }, []);

  const missing = !sheetId;
  const error = missing ? 'Fiche introuvable.' : state && state.sheetId === sheetId ? state.error : null;

  return {
    sheet: state?.sheet ?? null,
    category: state?.category ?? null,
    cards: state?.cards ?? [],
    setCards,
    isLoading: !missing && !state,
    error,
    reload,
  };
}