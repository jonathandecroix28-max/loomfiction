import { useState, useEffect, useCallback, useMemo } from 'react';
import { offlineIdeaVersionService } from '../../../services/offlineIdeaVersionService';
import type { IdeaVersionResponse } from '../../../types/ideaVersion';

export function useIdeaVersions(ideaId: number | null, versionId?: number | null) {
  const [versions, setVersions] = useState<IdeaVersionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(!!ideaId);
  const [error, setError] = useState<string | null>(null);

 
  const [prevIdeaId, setPrevIdeaId] = useState(ideaId);
  if (ideaId !== prevIdeaId) {
    setPrevIdeaId(ideaId);
    if (ideaId) {
      setIsLoading(true);
      setError(null);
    } else {
      setVersions([]);
      setIsLoading(false);
    }
  }

  const fetchVersions = useCallback(async () => {
    if (!ideaId) {
      setVersions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await offlineIdeaVersionService.getByIdeaId(ideaId);
      setVersions(data);
    } catch (err) {
      console.error('Erreur de chargement des versions d’idée :', err);
      setError('Impossible de charger les versions de l’idée.');
    } finally {
      setIsLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    if (!ideaId) return;
    let cancelled = false;

    offlineIdeaVersionService
      .getByIdeaId(ideaId)
      .then((data) => {
        if (!cancelled) setVersions(data);
      })
      .catch((err) => {
        console.error('Erreur de chargement des versions d’idée :', err);
        if (!cancelled) setError('Impossible de charger les versions de l’idée.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ideaId]);

  const selectedVersion = useMemo(() => {
    if (versions.length === 0) return null;

    if (versionId) {
      return versions.find((version) => version.id === versionId) ?? versions[versions.length - 1];
    }

    return [...versions].sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber))[0] ?? null;
  }, [versions, versionId]);

  return { versions, selectedVersion, isLoading, error, setVersions, refetch: fetchVersions };
}