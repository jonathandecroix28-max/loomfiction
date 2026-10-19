import { useCallback, useEffect, useState } from 'react';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineCategoryService } from '../../../services/offlineCategoryService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import type { SheetResponse } from '../../../types/sheet';
import type { CategoryResponse } from '../../../types/category';
import type { IdeaResponse } from '../../../types/idea';

export function useSheetPage(sheetId: number | null) {
  const [sheet, setSheet] = useState<SheetResponse | null>(null);
  const [category, setCategory] = useState<CategoryResponse | null>(null);
  const [cards, setCards] = useState<IdeaResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sheetId) {
      setError('Fiche introuvable.');
      setIsLoading(false);
      return;
    }

    try {
      const sheetData = await offlineSheetService.getById(sheetId);
      const [categoryData, cardsData] = await Promise.all([
        offlineCategoryService.getById(sheetData.categoryId).catch(() => null),
        offlineIdeaService.getBySheetId(sheetId),
      ]);
      setSheet(sheetData);
      setCategory(categoryData);
      setCards(cardsData);
      setError(null);
    } catch (err) {
      console.error('Erreur lors du chargement de la fiche :', err);
      setError('Impossible de charger cette fiche.');
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { sheet, category, cards, setCards, isLoading, error, reload: load };
}