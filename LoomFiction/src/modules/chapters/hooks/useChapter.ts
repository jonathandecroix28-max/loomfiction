import { useState, useEffect, useCallback } from 'react';
import { offlineChapterService } from '../../../services/offlineChapterService';
import type { ChapterResponse } from '../../../types/chapter';

type ChaptersResult = {
  bookId: number;
  chapters: ChapterResponse[];
  error: string | null;
};

const NO_CHAPTERS: ChapterResponse[] = [];

export function useChapters(bookId: number | null) {
  const [result, setResult] = useState<ChaptersResult | null>(null);

  const load = useCallback(async (id: number): Promise<ChaptersResult> => {
    try {
      const data = await offlineChapterService.getByBookId(id);
      return { bookId: id, chapters: data, error: null };
    } catch (err) {
      console.error('Erreur de chargement des chapitres :', err);
      return { bookId: id, chapters: [], error: 'Impossible de charger les chapitres.' };
    }
  }, []);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    void load(bookId).then((next) => {
      if (!cancelled) setResult(next);
    });

    return () => {
      cancelled = true;
    };
  }, [bookId, load]);

  const refetch = useCallback(async () => {
    if (!bookId) return;
    setResult(await load(bookId));
  }, [bookId, load]);

  const setChapters = useCallback(
    (next: ChapterResponse[]) => {
      if (bookId) setResult({ bookId, chapters: next, error: null });
    },
    [bookId],
  );

  const current = result && result.bookId === bookId ? result : null;

  return {
    chapters: current ? current.chapters : NO_CHAPTERS,
    isLoadingChapters: !!bookId && !current,
    error: current ? current.error : null,
    setChapters,
    refetch,
  };
}