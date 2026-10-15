import { useEffect, useState } from 'react';
import { loadBookForExport, type ExportBook } from '../../services/exportService';

export function useExportBook(bookId: number | null) {
  const [book, setBook] = useState<ExportBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) { setBook(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadBookForExport(bookId)
      .then((b) => !cancelled && setBook(b))
      .catch((e) => {
        console.error('Erreur de chargement du roman :', e);
        if (cancelled) return;
        setBook(null);
        setError('Impossible de charger ce roman.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [bookId]);

  return { book, loading, error };
}