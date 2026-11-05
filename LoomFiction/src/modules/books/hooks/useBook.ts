import { useState, useEffect, useCallback } from 'react';
import { offlineBookService } from '../../../services/offlineBookService';
import type { BookResponse } from '../../../types/book';

export function useBook(id: number) {
  const [book, setBook] = useState<BookResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    if (id) {
      setIsLoading(true);
      setError(null);
    }
  }

  const fetchBook = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await offlineBookService.getById(id);
      setBook(data);
    } catch {
      setError("Livre introuvable.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    offlineBookService
      .getById(id)
      .then((data) => {
        if (!cancelled) setBook(data);
      })
      .catch(() => {
        if (!cancelled) setError("Livre introuvable.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { book, isLoading, error, refreshBook: fetchBook };
}