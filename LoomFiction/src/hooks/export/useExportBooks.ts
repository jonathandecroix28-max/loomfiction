import { useEffect, useState } from 'react';
import { loadBooksForExport } from '../../services/exportService';

export type BookOption = { id: number; title: string };

export function useExportBooks() {
  const [books, setBooks] = useState<BookOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBooksForExport()
      .then((list) => !cancelled && setBooks(list))
      .catch((e) => {
        console.error('Erreur de chargement des romans :', e);
        if (!cancelled) setError('Impossible de charger tes romans.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return { books, loading, error };
}