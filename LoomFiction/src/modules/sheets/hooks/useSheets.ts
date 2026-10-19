import { useCallback, useEffect, useState } from 'react';
import { offlineSheetService } from '../../../services/offlineSheetService';
import type { SheetResponse } from '../../../types/sheet';

export function useSheets() {
  const [sheets, setSheets] = useState<SheetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSheets = useCallback(async () => {
    try {
      setSheets(await offlineSheetService.getAll());
    } catch (err) {
      console.error('Erreur de chargement des fiches :', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSheets();
  }, [refreshSheets]);

  return { sheets, isLoading, refreshSheets };
}