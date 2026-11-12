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
    let cancelled = false;

    offlineSheetService
      .getAll()
      .then((data) => {
        if (!cancelled) setSheets(data);
      })
      .catch((err) => console.error('Erreur de chargement des fiches :', err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { sheets, isLoading, refreshSheets };
}