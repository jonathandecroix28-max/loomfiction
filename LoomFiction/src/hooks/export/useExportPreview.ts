import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildPreviewDocument, type ExportBook } from '../../services/exportService';
import { stepScale } from '../../utils/export/text';
import { useDebouncedValue } from './useDebouncedValue';

export const PREVIEW_STEP = 12;

type Args = {
  book: ExportBook | null;
  chapters: ExportBook['chapters'];
  author: string;
  options: { titlePage: boolean; chapterNumbers: boolean };
};

export function useExportPreview({ book, chapters, author, options }: Args) {
  const [show, setShow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [dark, setDark] = useState(false);
  const [limit, setLimit] = useState(PREVIEW_STEP);
  const debouncedAuthor = useDebouncedValue(author);

  useEffect(() => setLimit(PREVIEW_STEP), [book]);

  const visible = useMemo(() => chapters.slice(0, limit), [chapters, limit]);
  const hidden = chapters.length - visible.length;

  const html = useMemo(() => {
    if (!(show || fullscreen) || !book || visible.length === 0) return '';
    return buildPreviewDocument(
      { ...book, author: debouncedAuthor.trim() || undefined, chapters: visible },
      options,
      { fontScale, dark }
    );
  }, [show, fullscreen, book, visible, debouncedAuthor, options, fontScale, dark]);

  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  return {
    show, toggleShow: () => setShow((v) => !v),
    fullscreen, openFullscreen: () => setFullscreen(true), closeFullscreen,
    dark, toggleDark: () => setDark((v) => !v),
    smaller: () => setFontScale((v) => stepScale(v, -0.1)),
    bigger: () => setFontScale((v) => stepScale(v, 0.1)),
    html, hidden, showMore: () => setLimit((v) => v + PREVIEW_STEP),
  };
}