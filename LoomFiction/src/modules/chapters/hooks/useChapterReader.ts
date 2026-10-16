import { useState, useEffect, useCallback, useMemo } from 'react';
import { offlineChapterService } from '../../../services/offlineChapterService';
import type { ChapterResponse } from '../../../types/chapter';

export function useChapterReader(bookId: number | null, chapterId: number | null) {
  const [chapter, setChapter] = useState<ChapterResponse | null>(null);
  const [chapters, setChapters] = useState<ChapterResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    offlineChapterService
      .getByBookId(bookId)
      .then((list) => {
        if (!cancelled) setChapters([...list].sort((a, b) => a.chapter_number - b.chapter_number));
      })
      .catch((err) => console.error('Erreur lors du chargement de la liste des chapitres :', err));

    return () => {
      cancelled = true;
    };
  }, [bookId, reloadKey]);

  useEffect(() => {
    if (!chapterId) {
      setError('Chapitre introuvable.');
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    offlineChapterService
      .getById(chapterId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setChapter(null);
          setError('Chapitre introuvable.');
          return;
        }
        setChapter(data);
      })
      .catch((err) => {
        console.error('Erreur lors du chargement du lecteur :', err);
        if (cancelled) return;
        setChapter(null);
        setError('Impossible de charger le chapitre.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, reloadKey]);

  const { prevChapter, nextChapter } = useMemo(() => {
    const index = chapter ? chapters.findIndex((c) => c.id === chapter.id) : -1;
    return {
      prevChapter: index > 0 ? chapters[index - 1] : null,
      nextChapter: index !== -1 && index < chapters.length - 1 ? chapters[index + 1] : null,
    };
  }, [chapter, chapters]);

  const refetch = useCallback(() => setReloadKey((key) => key + 1), []);

  return { chapter, chapters, isLoading, error, prevChapter, nextChapter, refetch };
}