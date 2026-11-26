import { useEffect, useState } from 'react';
import { loadBookForExport, type ExportBook } from '../../services/exportService';

type Result = { id: number; book: ExportBook | null; error: string | null };

export function useExportBook(bookId: number | null) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    loadBookForExport(bookId)
      .then((book) => {
        if (!cancelled) setResult({ id: bookId, book, error: null });
      })
      .catch((e) => {
        console.error('Erreur de chargement du roman :', e);
        if (!cancelled) setResult({ id: bookId, book: null, error: 'Impossible de charger ce roman.' });
      });
    return () => { cancelled = true; };
  }, [bookId]);

  const current = bookId && result?.id === bookId ? result : null;

  return {
    book: current?.book ?? null,
    loading: !!bookId && !current,
    error: current?.error ?? null,
  };
}