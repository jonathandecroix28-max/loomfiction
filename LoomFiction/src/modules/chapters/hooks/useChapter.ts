import { useState, useEffect, useCallback } from 'react';
import { offlineChapterService } from '../../../services/offlineChapterService';
import type { ChapterResponse } from '../../../types/chapter';

export function useChapters(bookId: number | null) {
  const [chapters, setChapters] = useState<ChapterResponse[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prevBookId, setPrevBookId] = useState(bookId);
  if (bookId !== prevBookId) {
    setPrevBookId(bookId);
    if (bookId) {
      setIsLoadingChapters(true);
      setError(null);
    }
  }

  const fetchChapters = useCallback(async () => {
    if (!bookId) return;
    try {
      setIsLoadingChapters(true);
      setError(null);
      const data = await offlineChapterService.getByBookId(bookId);
      setChapters(data);
    } catch (err) {
      console.error("Erreur de chargement des chapitres :", err);
      setError("Impossible de charger les chapitres.");
    } finally {
      setIsLoadingChapters(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    offlineChapterService
      .getByBookId(bookId)
      .then((data) => {
        if (!cancelled) setChapters(data);
      })
      .catch((err) => {
        console.error("Erreur de chargement des chapitres :", err);
        if (!cancelled) setError("Impossible de charger les chapitres.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingChapters(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  return { chapters, isLoadingChapters, error, setChapters, refetch: fetchChapters };
}