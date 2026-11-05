import { useCallback, useEffect, useMemo, useState } from 'react';
import { offlineSheetVersionService } from '../../../services/offlineSheetVersionService';
import type { SheetVersion } from '../../../types/sheetVersion';

/** Même forme que useIdeaVersions / useChapterVersions, pour les versions d'une fiche. */
export function useSheetVersions(sheetId: number | null, selectedVersionId: number | null = null) {
  const [versions, setVersions] = useState<SheetVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (sheetId == null) {
      setVersions([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await offlineSheetVersionService.getBySheet(sheetId);
      setVersions([...data].sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber)));
    } catch (err) {
      console.error('Erreur de chargement des versions de la fiche :', err);
      setError('Impossible de charger les versions de cette fiche.');
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    setIsLoading(true);
    void load();
  }, [load]);

  const selectedVersion = useMemo(
    () => (selectedVersionId == null ? null : versions.find((version) => version.id === selectedVersionId) ?? null),
    [versions, selectedVersionId]
  );

  return { versions, selectedVersion, isLoading, error, refetch: load };
}