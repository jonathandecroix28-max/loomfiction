import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EXPORT_FORMATS, type ExportFormat } from '../services/exportService';
import { sectionClass } from '../utils/export/ui';
import { useExportBooks } from '../hooks/export/useExportBooks';
import { useExportBook } from '../hooks/export/useExportBook';
import { useChapterSelection } from '../hooks/export/useChapterSelection';
import { useExportPreview } from '../hooks/export/useExportPreview';
import { useExportActions } from '../hooks/export/useExportActions';
import { useStoredAuthor } from '../hooks/export/useStoredAuthor';
import { BookPicker } from '../components/export/lists/BookPicker';
import { ChapterList } from '../components/export/lists/ChapterList';
import { FormatPicker } from '../components/export/FormatPicker';
import { ExportOptions } from '../components/export/options/ExportOptions';
import { ExportActions } from '../components/export/options/ExportActions';
import { ExportPreview } from '../components/export/preview/ExportPreview';
import { FullscreenPreview } from '../components/export/preview/FullscreenPreview';
import { PreviewControls } from '../components/export/preview/PreviewControls';
import { MoreChaptersButton } from '../components/export/MoreChaptersButton';

export function ExportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookId = Number(searchParams.get('book')) || null;

  const { books, loading: booksLoading, error: booksError } = useExportBooks();
  const { book, loading: bookLoading, error: bookError } = useExportBook(bookId);
  const selection = useChapterSelection(book);

  const [format, setFormat] = useState<ExportFormat>('docx');
  const [titlePage, setTitlePage] = useState(true);
  const [chapterNumbers, setChapterNumbers] = useState(true);
  const [spacedParagraphs, setSpacedParagraphs] = useState(true);
  const options = useMemo(
    () => ({ titlePage, chapterNumbers, spacedParagraphs }),
    [titlePage, chapterNumbers, spacedParagraphs]
  );
  const { author, setAuthor, remember } = useStoredAuthor();

  useEffect(() => {
    if (!bookId && books.length > 0) setSearchParams({ book: String(books[0].id) }, { replace: true });
  }, [bookId, books, setSearchParams]);

  const canAct = !!book && selection.chapters.length > 0 && !bookLoading;
  const preview = useExportPreview({ book, chapters: selection.chapters, author, options });
  const actions = useExportActions({ book, chapters: selection.chapters, author, remember, format, options, canAct });

  const previewControls = (
    <PreviewControls dark={preview.dark} onSmaller={preview.smaller} onBigger={preview.bigger} onToggleDark={preview.toggleDark} />
  );
  const moreButton = <MoreChaptersButton hidden={preview.hidden} onClick={preview.showMore} />;

  return (
    <div className="grow bg-[#1c1411] text-[#fcf9f2] font-serif overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">

        {booksLoading ? (
          <div className={`${sectionClass} text-amber-200/60`}>Chargement de tes romans...</div>
        ) : booksError ? (
          <div className="rounded-2xl border border-red-900/30 bg-red-950/20 p-6 text-red-200">{booksError}</div>
        ) : books.length === 0 ? (
          <div className={`${sectionClass} text-center py-12 space-y-4`}>
            <p className="text-4xl" aria-hidden>📚</p>
            <h2 className="text-xl sm:text-2xl font-bold text-amber-100">Aucun roman à exporter</h2>
            <p className="text-sm text-amber-200/60 max-w-md mx-auto">
              Crée un roman et écris au moins un chapitre : il apparaîtra ici, prêt à être exporté en Word, PDF, EPUB…
            </p>
            <Link
              to="/books"
              className="inline-block px-5 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium transition-colors shadow-md"
            >
              Aller à mes romans
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start">
            <div className="space-y-4">
              <BookPicker books={books} value={bookId} onChange={(id) => setSearchParams({ book: id })} />
              <ChapterList book={book} loading={bookLoading} selected={selection.selected}
                count={selection.chapters.length} totalWords={selection.totalWords}
                onToggle={selection.toggle} onAll={selection.selectAll} onNone={selection.selectNone} />
              <FormatPicker value={format} onChange={setFormat} />
              <ExportOptions author={author} onAuthor={setAuthor}
                titlePage={titlePage} onTitlePage={setTitlePage}
                chapterNumbers={chapterNumbers} onChapterNumbers={setChapterNumbers}
                spacedParagraphs={spacedParagraphs} onSpacedParagraphs={setSpacedParagraphs} />
              <ExportActions
                status={bookError ? { type: 'error', text: bookError } : actions.status}
                busy={actions.busy}
                copying={actions.copying}
                progress={actions.progress}
                canAct={canAct}
                formatLabel={EXPORT_FORMATS.find((f) => f.key === format)?.label}
                showSelectHint={!canAct && !bookLoading && !!book && book.chapters.length > 0}
                onExport={actions.doExport}
                onCopy={actions.doCopy}
              />
            </div>

            <ExportPreview show={preview.show} html={preview.html} canAct={canAct}
              fullscreen={preview.fullscreen} hasBook={!!book} bookLoading={bookLoading}
              hasSelection={selection.chapters.length > 0}
              controls={previewControls} moreButton={moreButton}
              onToggle={preview.toggleShow} onFullscreen={preview.openFullscreen} />
          </div>
        )}
      </div>

      {preview.fullscreen && (
        <FullscreenPreview title={book?.title} html={preview.html}
          controls={previewControls} footer={moreButton} onClose={preview.closeFullscreen} />
      )}
    </div>
  );
}

export default ExportPage;