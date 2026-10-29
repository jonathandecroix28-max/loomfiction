import { useState, useEffect, useCallback } from 'react';
import { offlineBookService } from '../../../services/offlineBookService';
import type { BookResponse } from '../../../types/book';

const LOAD_ERROR = "Impossible de charger la bibliothèque.";

export function useBooks() {
  const [books, setBooks] = useState<BookResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await offlineBookService.getAll();
      setBooks(data);
    } catch {
      setError(LOAD_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    let cancelled = false;

    offlineBookService
      .getAll()
      .then((data) => {
        if (!cancelled) setBooks(data);
      })
      .catch(() => {
        if (!cancelled) setError(LOAD_ERROR);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { books, isLoading, error, refreshBooks: fetchBooks, setBooks };
}