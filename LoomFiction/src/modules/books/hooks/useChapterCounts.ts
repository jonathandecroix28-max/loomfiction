import { useCallback, useEffect, useState } from 'react';
import { getDb, SYNC_ENABLED } from '../../../db/loomfictionDb';
import type { BookResponse } from '../../../types/book';


export function useChapterCounts(books: BookResponse[]) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const ids = books.map((book) => book.id).join(',');

  useEffect(() => {
    let cancelled = false;
    const bookIds = ids ? ids.split(',').map(Number) : [];

    (async () => {
      try {
        const db = await getDb();
        const entries = await Promise.all(
          bookIds.map(async (id) => [id, await db.countFromIndex('chapters', 'by_book', id)] as const)
        );
        if (!cancelled) setCounts(Object.fromEntries(entries));
      } catch (error) {
        console.warn('Impossible de compter les chapitres :', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ids]);

  return useCallback(
    (book: BookResponse): number => {
      const local = counts[book.id];
      const remote = book.chapterCount ?? 0;
      if (local === undefined) return remote;
      return SYNC_ENABLED ? Math.max(local, remote) : local;
    },
    [counts]
  );
}