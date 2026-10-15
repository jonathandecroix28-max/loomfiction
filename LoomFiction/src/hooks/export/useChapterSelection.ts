import { useEffect, useMemo, useState } from 'react';
import { countWords, type ExportBook } from '../../services/exportService';

export function useChapterSelection(book: ExportBook | null) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelected(new Set((book?.chapters ?? []).map((_, i) => i)));
  }, [book]);

  const chapters = useMemo(
    () => (book ? book.chapters.filter((_, i) => selected.has(i)) : []),
    [book, selected]
  );
  const totalWords = useMemo(
    () => chapters.reduce((sum, c) => sum + countWords(c.content), 0),
    [chapters]
  );

  const toggle = (index: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return {
    selected,
    chapters,
    totalWords,
    toggle,
    selectAll: () => setSelected(new Set((book?.chapters ?? []).map((_, i) => i))),
    selectNone: () => setSelected(new Set()),
  };
}