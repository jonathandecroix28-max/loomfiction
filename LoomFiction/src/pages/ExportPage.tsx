import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import {
  EXPORT_FORMATS,
  buildPreviewDocument,
  copyBookToClipboard,
  countWords,
  exportBook,
  loadBookForExport,
  loadBooksForExport,
  type ExportBook,
  type ExportFormat,
} from '../services/exportService';

const AUTHOR_KEY = 'plotweaver:export-author';
const PREVIEW_STEP = 12; // nombre de chapitres affichés dans l'aperçu, par paquet

type BookOption = { id: number; title: string };
type Status = { type: 'ok' | 'error'; text: string } | null;

function readAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? '';
  } catch {
    return '';
  }
}

export function ExportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookIdParam = Number(searchParams.get('book')) || null;

  const [books, setBooks] = useState<BookOption[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState<string | null>(null);

  const [book, setBook] = useState<ExportBook | null>(null);
  const [bookLoading, setBookLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [format, setFormat] = useState<ExportFormat>('docx');
  const [author, setAuthor] = useState(readAuthor);
  const [debouncedAuthor, setDebouncedAuthor] = useState(author);
  const [titlePage, setTitlePage] = useState(true);
  const [chapterNumbers, setChapterNumbers] = useState(true);

  // Aperçu
  const [showPreview, setShowPreview] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [darkPreview, setDarkPreview] = useState(false);
  const [previewLimit, setPreviewLimit] = useState(PREVIEW_STEP);

  // Actions
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState<Status>(null);

  /* ───── Chargement de la liste des romans ───── */
  useEffect(() => {
    let cancelled = false;

    loadBooksForExport()
      .then((list) => {
        if (cancelled) return;
        setBooks(list);
        // Sans roman choisi dans l'URL, on prend le premier
        if (!bookIdParam && list.length > 0) {
          setSearchParams({ book: String(list[0].id) }, { replace: true });
        }
      })
      .catch((error) => {
        console.error('Erreur de chargement des romans :', error);
        if (!cancelled) setBooksError('Impossible de charger tes romans.');
      })
      .finally(() => {
        if (!cancelled) setBooksLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───── Chargement du roman choisi (avec ses chapitres) ───── */
  useEffect(() => {
    if (!bookIdParam) {
      setBook(null);
      return;
    }

    let cancelled = false;
    setBookLoading(true);
    setStatus(null);

    loadBookForExport(bookIdParam)
      .then((loaded) => {
        if (cancelled) return;
        setBook(loaded);
        setSelected(new Set(loaded.chapters.map((_, index) => index)));
        setPreviewLimit(PREVIEW_STEP);
      })
      .catch((error) => {
        console.error('Erreur de chargement du roman :', error);
        if (cancelled) return;
        setBook(null);
        setStatus({ type: 'error', text: 'Impossible de charger ce roman.' });
      })
      .finally(() => {
        if (!cancelled) setBookLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookIdParam]);

  // On attend la fin de la saisie avant de reconstruire l'aperçu
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAuthor(author), 300);
    return () => clearTimeout(timer);
  }, [author]);

  // Plein écran : verrouille le défilement de la page derrière, Échap pour fermer
  useEffect(() => {
    if (!fullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  /* ───── Données dérivées ───── */
  const options = useMemo(() => ({ titlePage, chapterNumbers }), [titlePage, chapterNumbers]);

  const selectedChapters = useMemo(
    () => (book ? book.chapters.filter((_, index) => selected.has(index)) : []),
    [book, selected]
  );

  const totalWords = useMemo(
    () => selectedChapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0),
    [selectedChapters]
  );

  // Aperçu limité à quelques chapitres : reste fluide même sur un long roman
  const previewChapters = useMemo(() => selectedChapters.slice(0, previewLimit), [selectedChapters, previewLimit]);
  const hiddenChapters = selectedChapters.length - previewChapters.length;

  const previewHtml = useMemo(() => {
    if (!(showPreview || fullscreen) || !book || previewChapters.length === 0) return '';
    return buildPreviewDocument(
      { ...book, author: debouncedAuthor.trim() || undefined, chapters: previewChapters },
      options,
      { fontScale, dark: darkPreview }
    );
  }, [showPreview, fullscreen, book, previewChapters, debouncedAuthor, options, fontScale, darkPreview]);

  const canAct = !!book && selectedChapters.length > 0 && !bookLoading;
  const formatInfo = EXPORT_FORMATS.find((item) => item.key === format);

  /* ───── Actions ───── */
  const toggleChapter = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set((book?.chapters ?? []).map((_, index) => index)));
  const selectNone = () => setSelected(new Set());

  const exportData = (): ExportBook => ({
    ...(book as ExportBook),
    author: author.trim() || undefined,
    chapters: selectedChapters,
  });

  const rememberAuthor = () => {
    try {
      localStorage.setItem(AUTHOR_KEY, author.trim());
    } catch {
      // Ignorer les erreurs de stockage local
    }
  };

  const handleExport = async () => {
    if (!canAct) return;

    setBusy(true);
    setProgress(null);
    setStatus(null);
    try {
      rememberAuthor();
      await exportBook(exportData(), format, options, (done, total) => setProgress({ done, total }));
      setStatus({ type: 'ok', text: formatInfo?.done ?? 'Export terminé.' });
    } catch (error) {
      console.error('Erreur lors de l’export :', error);
      setStatus({ type: 'error', text: 'L’export a échoué. Réessaie dans un instant.' });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleCopy = async () => {
    if (!canAct) return;

    setCopying(true);
    setStatus(null);
    try {
      rememberAuthor();
      const mode = await copyBookToClipboard(exportData(), options);
      setStatus({
        type: 'ok',
        text:
          mode === 'rich'
            ? 'Texte copié avec sa mise en forme : colle-le dans Word, Google Docs, Notion ou un éditeur de blog.'
            : 'Texte copié (sans mise en forme, ton navigateur ne la permet pas).',
      });
    } catch (error) {
      console.error('Erreur lors de la copie :', error);
      setStatus({ type: 'error', text: 'Copie impossible. Autorise l’accès au presse-papiers ou utilise un export.' });
    } finally {
      setCopying(false);
    }
  };

  const sectionClass = 'rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/60 p-4 sm:p-5 shadow-xl space-y-3';
  const labelClass = 'block text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40';
  const smallBtn =
    'px-2.5 py-1.5 rounded-lg border border-amber-900/30 bg-neutral-900 text-amber-200 text-xs font-medium cursor-pointer hover:border-amber-700/60 transition';

  /* ───── Éléments d'aperçu réutilisés (inline + plein écran) ───── */
  const previewControls = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setFontScale((value) => Math.max(0.8, Math.round((value - 0.1) * 10) / 10))}
        aria-label="Réduire la taille du texte"
        className={smallBtn}
      >
        A−
      </button>
      <button
        type="button"
        onClick={() => setFontScale((value) => Math.min(1.6, Math.round((value + 0.1) * 10) / 10))}
        aria-label="Agrandir la taille du texte"
        className={smallBtn}
      >
        A+
      </button>
      <button
        type="button"
        onClick={() => setDarkPreview((value) => !value)}
        aria-label={darkPreview ? 'Papier clair' : 'Papier sombre'}
        className={smallBtn}
      >
        {darkPreview ? '☀️' : '🌙'}
      </button>
    </div>
  );

  const moreChaptersButton =
    hiddenChapters > 0 ? (
      <button
        type="button"
        onClick={() => setPreviewLimit((value) => value + PREVIEW_STEP)}
        className={`${smallBtn} w-full py-2.5`}
      >
        Afficher {Math.min(PREVIEW_STEP, hiddenChapters)} chapitre{Math.min(PREVIEW_STEP, hiddenChapters) > 1 ? 's' : ''} de plus
        <span className="text-amber-200/40"> ({hiddenChapters} masqué{hiddenChapters > 1 ? 's' : ''} dans l’aperçu)</span>
      </button>
    ) : null;

  const fullscreenView =
    fullscreen && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Aperçu en plein écran"
            className="fixed inset-0 z-80 flex flex-col bg-[#1c1411] text-[#fcf9f2] font-serif"
          >
            <div className="flex items-center justify-between gap-2 border-b border-amber-900/40 bg-neutral-950 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium cursor-pointer"
              >
                ✕ Fermer
              </button>
              <span className="hidden sm:block min-w-0 truncate text-sm text-amber-200/60">{book?.title}</span>
              {previewControls}
            </div>

            {previewHtml ? (
              <iframe
                title="Aperçu de l’export en plein écran"
                sandbox=""
                srcDoc={previewHtml}
                className="min-h-0 w-full flex-1 border-0 bg-white"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-amber-200/50">
                Sélectionne au moins un chapitre pour générer l’aperçu.
              </div>
            )}

            {moreChaptersButton && (
              <div className="border-t border-amber-900/40 bg-neutral-950 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                {moreChaptersButton}
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  /* ───── Rendu ───── */
  return (
    <div className="grow bg-[#1c1411] text-[#fcf9f2] font-serif overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <header>
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-200/40 mb-1 sm:mb-2">Publication</p>
          <h1 className="text-2xl sm:text-4xl font-bold text-amber-100">Exporter un roman</h1>
          <p className="text-sm sm:text-base text-amber-200/55 mt-1 sm:mt-2 max-w-2xl">
            Choisis le roman, les chapitres et le format, vérifie l’aperçu, puis télécharge ton manuscrit ou copie-le pour
            le coller ailleurs.
          </p>
        </header>

        {booksLoading ? (
          <div className={`${sectionClass} text-amber-200/60`}>Chargement de tes romans...</div>
        ) : booksError ? (
          <div className="rounded-2xl border border-red-900/30 bg-red-950/20 p-6 text-red-200">{booksError}</div>
        ) : books.length === 0 ? (
          <div className={`${sectionClass} text-center py-10`}>
            <div className="text-3xl mb-2" aria-hidden>📚</div>
            <p className="text-amber-200/70">Tu n’as pas encore de roman à exporter.</p>
            <Link
              to="/books"
              className="inline-block mt-4 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium transition-colors"
            >
              Aller à mes romans
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start">
            {/* ───── Réglages ───── */}
            <div className="space-y-4">
              {/* Roman */}
              <section className={sectionClass}>
                <label htmlFor="export-book" className={labelClass}>Roman</label>
                <select
                  id="export-book"
                  value={bookIdParam ?? ''}
                  onChange={(event) => setSearchParams({ book: event.target.value })}
                  className="w-full rounded-xl border border-amber-900/30 bg-neutral-900 px-3 sm:px-4 py-2.5 sm:py-3 text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {books.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
              </section>

              {/* Chapitres */}
              <section className={sectionClass}>
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>Chapitres</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAll} className={smallBtn}>Tous</button>
                    <button type="button" onClick={selectNone} className={smallBtn}>Aucun</button>
                  </div>
                </div>

                {bookLoading ? (
                  <p className="text-sm text-amber-200/50 py-4">Chargement des chapitres...</p>
                ) : !book || book.chapters.length === 0 ? (
                  <p className="text-sm text-amber-200/50 py-4">Ce roman ne contient aucun chapitre.</p>
                ) : (
                  <ul className="max-h-60 overflow-y-auto rounded-xl border border-amber-900/20 divide-y divide-amber-900/10">
                    {book.chapters.map((chapter, index) => (
                      <li key={`${chapter.number}-${index}`}>
                        <label className="flex items-center gap-3 px-3 py-2.5 text-sm text-amber-100/90 cursor-pointer hover:bg-neutral-900/50">
                          <input type="checkbox" checked={selected.has(index)} onChange={() => toggleChapter(index)} />
                          <span className="text-amber-200/40 shrink-0">{chapter.number}.</span>
                          <span className="truncate">{chapter.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}

                {book && book.chapters.length > 0 && (
                  <p className="text-xs text-amber-200/50">
                    {selectedChapters.length} chapitre{selectedChapters.length > 1 ? 's' : ''} sélectionné
                    {selectedChapters.length > 1 ? 's' : ''} · {totalWords.toLocaleString('fr-FR')} mots
                  </p>
                )}
              </section>

              {/* Format */}
              <section className={sectionClass}>
                <span className={labelClass}>Format</span>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {EXPORT_FORMATS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFormat(item.key)}
                      aria-pressed={format === item.key}
                      className={`text-left rounded-2xl border p-3 transition cursor-pointer ${
                        format === item.key
                          ? 'bg-amber-900/60 border-amber-600 text-amber-50'
                          : 'bg-neutral-900 border-amber-900/30 text-amber-200 hover:border-amber-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm sm:text-base">
                        <span aria-hidden className="text-lg">{item.icon}</span>
                        {item.label}
                      </div>
                      <p className="mt-1 text-[11px] sm:text-xs text-amber-200/50 leading-snug">{item.hint}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* Options */}
              <section className={sectionClass}>
                <div>
                  <label htmlFor="export-author" className={`${labelClass} mb-1.5`}>Auteur (facultatif)</label>
                  <input
                    id="export-author"
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder="Ton nom ou ton pseudo"
                    className="w-full rounded-xl border border-amber-900/30 bg-neutral-900 px-4 py-2.5 text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-amber-200/80 cursor-pointer">
                  <input type="checkbox" checked={titlePage} onChange={(event) => setTitlePage(event.target.checked)} />
                  Ajouter une page de titre
                </label>
                <label className="flex items-center gap-2 text-sm text-amber-200/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chapterNumbers}
                    onChange={(event) => setChapterNumbers(event.target.checked)}
                  />
                  Afficher les numéros de chapitre
                </label>
              </section>

              {/* Actions */}
              <section className="space-y-3">
                {status && (
                  <div
                    role="status"
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      status.type === 'ok'
                        ? 'border-emerald-900/30 bg-emerald-950/30 text-emerald-300'
                        : 'border-red-900/40 bg-red-950/30 text-red-200'
                    }`}
                  >
                    {status.text}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={busy || copying || !canAct}
                  className="w-full px-4 py-3.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy
                    ? progress && progress.total > 1
                      ? `Préparation… ${progress.done}/${progress.total}`
                      : 'Préparation…'
                    : `Exporter en ${formatInfo?.label}`}
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={busy || copying || !canAct}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-amber-900/30 text-amber-200 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copying ? 'Copie…' : '📋 Copier le texte (pour le coller ailleurs)'}
                </button>

                {!canAct && !bookLoading && book && book.chapters.length > 0 && (
                  <p className="text-xs text-amber-200/50 text-center">Sélectionne au moins un chapitre.</p>
                )}
              </section>
            </div>

            {/* ───── Aperçu ───── */}
            <section className={`${sectionClass} lg:sticky lg:top-24`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={labelClass}>Aperçu</span>
                  <p className="text-xs text-amber-200/40 mt-1">
                    Mise en page indicative : le rendu final dépend du format choisi.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setFullscreen(true)}
                    disabled={!canAct}
                    className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs font-medium cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ⛶ Plein écran
                  </button>
                  <button type="button" onClick={() => setShowPreview((value) => !value)} className={smallBtn}>
                    {showPreview ? 'Masquer' : 'Afficher'}
                  </button>
                </div>
              </div>

              {showPreview && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-amber-200/40">Texte et papier</span>
                    {previewControls}
                  </div>

                  {!fullscreen &&
                    (book && selectedChapters.length > 0 && previewHtml ? (
                      <iframe
                        title="Aperçu de l’export"
                        sandbox=""
                        srcDoc={previewHtml}
                        className="w-full h-[55vh] lg:h-[calc(100vh-17rem)] rounded-xl border border-amber-900/20 bg-white"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-amber-900/30 py-16 text-center text-sm text-amber-200/50">
                        {bookLoading
                          ? 'Chargement...'
                          : !book
                            ? 'Choisis un roman pour prévisualiser l’export.'
                            : selectedChapters.length === 0
                              ? 'Sélectionne au moins un chapitre pour générer l’aperçu.'
                              : 'Rien à afficher pour le moment.'}
                      </div>
                    ))}

                  {!fullscreen && moreChaptersButton}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {fullscreenView}
    </div>
  );
}

export default ExportPage;