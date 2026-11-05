import { useState, useEffect, useCallback } from 'react';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import type { IdeaResponse } from '../../../types/idea';

export function useIdeas(bookId?: number | null) {
  const [ideas, setIdeas] = useState<IdeaResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [prevBookId, setPrevBookId] = useState(bookId);
  if (bookId !== prevBookId) {
    setPrevBookId(bookId);
    setIsLoading(true);
    setError(null);
  }

  const request = useCallback(
    () =>
      bookId !== undefined && bookId !== null
        ? offlineIdeaService.getByBookId(bookId)
        : offlineIdeaService.getAll(),
    [bookId]
  );

  const fetchIdeas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await request();
      setIdeas(data);
    } catch (err) {
      console.error("Erreur chargement idées :", err);
      setError("Impossible de charger les idées.");
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let cancelled = false;

    request()
      .then((data) => {
        if (!cancelled) setIdeas(data);
      })
      .catch((err) => {
        console.error("Erreur chargement idées :", err);
        if (!cancelled) setError("Impossible de charger les idées.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request]);

  return { ideas, setIdeas, isLoading, error, refreshIdeas: fetchIdeas };
}