import { memo, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useChapterReader } from '../hooks/useChapterReader';
import { useEdgeSwipeNavigation } from '../hooks/useEdgeSwipeNavigation';
import { EdgeSwipeHint } from '../components/EdgeSwipeHint';

const ChapterContent = memo(function ChapterContent({ html }: { html: string }) {
  const clean = useMemo(() => DOMPurify.sanitize(html), [html]);
  return (
    <div
      className="prose prose-invert max-w-none text-lg leading-relaxed text-amber-100/90 font-serif mb-16"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
});

export function ChapterReadPage() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();

  const numBookId = bookId ? Number(bookId) : null;
  const numChapterId = chapterId ? Number(chapterId) : null;

  const { chapter, isLoading, error, prevChapter, nextChapter } = useChapterReader(numBookId, numChapterId);

  const goToChapter = useCallback(
    (id: number) => navigate(`/books/${bookId}/chapters/${id}/read`),
    [navigate, bookId]
  );

  const pull = useEdgeSwipeNavigation({
    enabled: !isLoading && !!chapter,
    onPrev: prevChapter ? () => goToChapter(prevChapter.id) : undefined,
    onNext: nextChapter ? () => goToChapter(nextChapter.id) : undefined,
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [numChapterId]);

  useEffect(() => {
    if (!isLoading && (error || !chapter)) navigate('/404', { replace: true });
  }, [isLoading, error, chapter, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1c1411] flex items-center justify-center font-serif text-amber-200/60">
        Chargement du grimoire...
      </div>
    );
  }

  if (error || !chapter) return null;

  return (
    <div className="min-h-screen bg-[#1c1411] text-[#fcf9f2] flex flex-col font-serif overflow-x-hidden">
      <header className="border-b border-amber-900/40 bg-neutral-950/80 px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-md sticky top-0 z-10 backdrop-blur-xs">
        <button
          onClick={() => navigate(`/books/${bookId}`)}
          className="text-amber-200/60 hover:text-amber-100 transition-colors text-sm cursor-pointer flex items-center gap-1 font-sans touch-target"
        >
          &larr; Retour au livre
        </button>
        <span className="text-sm font-sans text-amber-200/70 font-medium">Chapitre {chapter.chapter_number}</span>
        <div className="hidden sm:block w-16"></div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif text-amber-100 mb-10 text-center tracking-tight">
          {chapter.title}
        </h1>

        <ChapterContent html={chapter.content || ''} />

        <div className="border-t border-amber-900/30 pt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-sans">
          {prevChapter ? (
            <button
              onClick={() => goToChapter(prevChapter.id)}
              className="px-5 py-2.5 rounded-xl border border-amber-900/30 hover:bg-neutral-900 text-amber-200 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto touch-target"
            >
              &larr; Chapitre précédent
            </button>
          ) : (
            <div></div>
          )}

          {nextChapter && (
            <button
              onClick={() => goToChapter(nextChapter.id)}
              className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium transition-colors shadow-md cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto sm:ml-auto touch-target"
            >
              Chapitre suivant &rarr;
            </button>
          )}
        </div>
      </main>

      <EdgeSwipeHint
        pull={pull}
        prevLabel={prevChapter ? `Chapitre ${prevChapter.chapter_number} · ${prevChapter.title}` : undefined}
        nextLabel={nextChapter ? `Chapitre ${nextChapter.chapter_number} · ${nextChapter.title}` : undefined}
      />
    </div>
  );
}

export default ChapterReadPage;