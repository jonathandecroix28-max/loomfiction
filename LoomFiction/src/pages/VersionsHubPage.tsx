import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { offlineChapterService } from '../services/offlineChapterService';
import { offlineChapterVersionService } from '../services/offlineChapterVersionService';
import { offlineIdeaService } from '../services/offlineIdeaService';
import { offlineIdeaVersionService } from '../services/offlineIdeaVersionService';
import { offlineBookService } from '../services/offlineBookService';
import { useCategories } from '../modules/categories/hooks/useCategories';
import { offlineSheetService } from '../services/offlineSheetService';
import { offlineSheetVersionService } from '../services/offlineSheetVersionService';
import { bookOfSheet } from '../modules/sheets/sheetLinks';
import type { BookResponse } from '../types/book';
import type { ChapterResponse } from '../types/chapter';
import type { ChapterVersionResponse } from '../types/chapterVersion';
import type { IdeaResponse } from '../types/idea';
import type { IdeaVersionResponse } from '../types/ideaVersion';
import type { SheetResponse } from '../types/sheet';
import type { SheetVersion } from '../types/sheetVersion';
import { IconBooks, IconGlobe, IconSheet } from '../components/icons';
import { useConfirm, useToast } from '../components/feedback/FeedbackProvider';
import { VersionsSection } from '../components/versions/VersionsSection';
import { HubCompareModal } from '../components/versions/HubCompareModal';
import type { VersionRow } from '../components/versionsHubTypes';
import { htmlToPlainText } from '../utils/versions/sanitizeHtml';

interface Loaded {
  books: BookResponse[];
  chapters: { version: ChapterVersionResponse; chapter: ChapterResponse | null }[];
  ideas: { version: IdeaVersionResponse; idea: IdeaResponse | null }[];
  sheets: SheetResponse[];
  sheetVersions: SheetVersion[];
  sheetBooks: Map<number, number | null>;
}

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function cached<T>(cache: Map<number, Promise<T | null>>, id: number, fetch: (id: number) => Promise<T>) {
  let promise = cache.get(id);
  if (!promise) {
    promise = fetch(id).catch(() => null);
    cache.set(id, promise);
  }
  return promise;
}

const pill =
  'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-sans font-medium whitespace-nowrap';

export function VersionsHubPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { categories } = useCategories();

  const [loaded, setLoaded] = useState<Loaded>({
    books: [],
    chapters: [],
    ideas: [],
    sheets: [],
    sheetVersions: [],
    sheetBooks: new Map(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [bookFilter, setBookFilter] = useState('all');

  const [activeCompare, setActiveCompare] = useState<{
    parentTitle: string;
    versionA: VersionRow;
    versionB: VersionRow;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [chapterVersions, ideaVersions, books] = await Promise.all([
          offlineChapterVersionService.getAll(),
          offlineIdeaVersionService.getAll(),
          offlineBookService.getAll(),
        ]);

        const [sheetVersions, sheets, allIdeas] = await Promise.all([
          offlineSheetVersionService.getAll(),
          offlineSheetService.getAll(),
          offlineIdeaService.getAll(),
        ]).catch((sheetError): [SheetVersion[], SheetResponse[], IdeaResponse[]] => {
          console.error('Erreur de chargement des versions de fiches :', sheetError);
          return [[], [], []];
        });

        const cardsBySheet = new Map<number, IdeaResponse[]>();
        for (const idea of allIdeas ?? []) {
          if (idea.sheetId == null) continue;
          const cards = cardsBySheet.get(idea.sheetId);
          if (cards) cards.push(idea);
          else cardsBySheet.set(idea.sheetId, [idea]);
        }
        const sheetBooks = new Map<number, number | null>();
        cardsBySheet.forEach((cards, sheetId) => sheetBooks.set(sheetId, bookOfSheet(cards) ?? null));

        const chapterCache = new Map<number, Promise<ChapterResponse | null>>();
        const ideaCache = new Map<number, Promise<IdeaResponse | null>>();

        const [chapters, ideas] = await Promise.all([
          Promise.all(
            chapterVersions.map(async (version) => ({
              version,
              chapter: await cached(chapterCache, version.chapterId, (id) => offlineChapterService.getById(id)),
            }))
          ),
          Promise.all(
            ideaVersions.map(async (version) => ({
              version,
              idea: await cached(ideaCache, version.ideaId, (id) => offlineIdeaService.getById(id)),
            }))
          ),
        ]);

        if (cancelled) return;
        setLoaded({
          books: books ?? [],
          chapters,
          ideas,
          sheets: sheets ?? [],
          sheetVersions: sheetVersions ?? [],
          sheetBooks,
        });
      } catch (loadError) {
        console.error('Erreur de chargement du tableau des versions :', loadError);
        if (!cancelled) setError('Impossible de charger les versions.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeleteVersion = async (row: VersionRow) => {
    const ok = await confirm({
      title: 'Supprimer définitivement cette version ?',
      message: 'Cette action est irréversible.',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      if (row.kind === 'chapter') {
        await offlineChapterVersionService.remove(row.versionId);
        setLoaded((prev) => ({
          ...prev,
          chapters: prev.chapters.filter((c) => c.version.id !== row.versionId),
        }));
      } else if (row.kind === 'idea') {
        await offlineIdeaVersionService.remove(row.versionId);
        setLoaded((prev) => ({
          ...prev,
          ideas: prev.ideas.filter((i) => i.version.id !== row.versionId),
        }));
      } else {
        const removed = await offlineSheetVersionService.remove(row.versionId);
        if (!removed) throw new Error('Suppression de la version de fiche refusée');
        setLoaded((prev) => ({
          ...prev,
          sheetVersions: prev.sheetVersions.filter((v) => v.id !== row.versionId),
        }));
      }
      toast.success(`Version v${row.versionNumber} supprimée.`);
    } catch (err) {
      console.error('Erreur lors de la suppression de la version :', err);
      toast.error('Impossible de supprimer la version.');
    }
  };

  const bookTitleById = useMemo(
    () => new Map(loaded.books.map((book) => [book.id, book.title] as const)),
    [loaded.books]
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories]
  );
  const sheetById = useMemo(
    () => new Map(loaded.sheets.map((sheet) => [sheet.id, sheet] as const)),
    [loaded.sheets]
  );
  const sheetNameById = useMemo(
    () => new Map(loaded.sheets.map((sheet) => [sheet.id, sheet.name] as const)),
    [loaded.sheets]
  );

  const byNewest = (a: VersionRow, b: VersionRow) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

  const chapterRows = useMemo<VersionRow[]>(
    () =>
      loaded.chapters
        .map(({ version, chapter }): VersionRow => ({
          key: `chapter-${version.id}`,
          parentKey: `chapter-parent-${version.chapterId}`,
          versionId: version.id,
          kind: 'chapter',
          versionNumber: version.versionNumber,
          versionName: version.name ?? '',
          updatedAt: version.updatedAt,
          parentTitle: chapter ? chapter.title : 'Chapitre supprimé',
          missing: !chapter,
          bookId: chapter ? Number(chapter.book_id) : null,
          chapterNumber: chapter?.chapter_number,
          openPath: chapter ? `/books/${chapter.book_id}/chapters/${chapter.id}/versions/${version.id}` : null,
          parentEditorPath: chapter ? `/books/${chapter.book_id}/chapters/${chapter.id}` : null,
          rawTextContent: version.content ?? '',
          isRichText: true,
        }))
        .sort(byNewest),
    [loaded.chapters]
  );

  const ideaRows = useMemo<VersionRow[]>(
    () =>
      loaded.ideas
        .map(({ version, idea }): VersionRow => ({
          key: `idea-${version.id}`,
          parentKey: `idea-parent-${version.ideaId}`,
          versionId: version.id,
          kind: 'idea',
          versionNumber: version.versionNumber,
          versionName: version.name ?? '',
          updatedAt: version.updatedAt,
          parentTitle: idea ? idea.name : 'Idée supprimée',
          missing: !idea,
          bookId: idea?.bookId ?? null,
          categoryId: idea?.categoryId ?? null,
          sheetId: idea?.sheetId ?? null,
          openPath: idea ? `/ideas/${idea.id}/versions/${version.id}` : null,
          parentEditorPath: idea ? `/ideas/${idea.id}` : null,
          rawTextContent:
            (version as unknown as { content?: string; description?: string }).content ??
            (version as unknown as { description?: string }).description ??
            '',
          isRichText: true,
        }))
        .sort(byNewest),
    [loaded.ideas]
  );

  const sheetRows = useMemo<VersionRow[]>(
    () =>
      loaded.sheetVersions
        .map((version): VersionRow => {
          const sheet = sheetById.get(version.sheetId);
          const cardsSummary = version.cards.map(
            (c) => `— ${c.name}${c.description ? ` : ${htmlToPlainText(c.description)}` : ''}`
          );
          return {
            key: `sheet-${version.id}`,
            parentKey: `sheet-parent-${version.sheetId}`,
            versionId: version.id,
            kind: 'sheet',
            versionNumber: version.versionNumber,
            versionName: sheet && version.name !== sheet.name ? version.name ?? '' : '',
            updatedAt: version.updatedAt,
            parentTitle: sheet ? sheet.name : version.name || 'Fiche supprimée',
            missing: !sheet,
            bookId: sheet ? loaded.sheetBooks.get(sheet.id) ?? null : null,
            categoryId: sheet?.categoryId ?? null,
            sheetId: sheet?.id ?? null,
            cardCount: version.cards.length,
            openPath: sheet ? `/ideas/fiches/${sheet.id}/versions/${version.id}` : null,
            parentEditorPath: sheet ? `/ideas/fiches/${sheet.id}` : null,
            rawTextContent: cardsSummary.join('\n') || 'Aucune carte dans cette version.',
            isRichText: false,
            sheetCardsSummary: cardsSummary,
          };
        })
        .sort(byNewest),
    [loaded.sheetVersions, loaded.sheetBooks, sheetById]
  );

  const bookLabel = (row: VersionRow): string | null =>
    row.bookId == null ? null : bookTitleById.get(row.bookId) ?? 'Roman introuvable';

  const query = fold(search.trim());
  const matches = (row: VersionRow) => {
    if (bookFilter === 'none') {
      if (row.missing || row.bookId != null) return false;
    } else if (bookFilter !== 'all' && String(row.bookId) !== bookFilter) {
      return false;
    }

    if (!query) return true;
    const category = row.categoryId != null ? categoryById.get(row.categoryId)?.name : '';
    const sheet = row.sheetId != null ? sheetNameById.get(row.sheetId) : '';
    return fold(
      [row.parentTitle, row.versionName, bookLabel(row) ?? '', category ?? '', sheet ?? ''].join('\n')
    ).includes(query);
  };

  const visibleChapters = chapterRows.filter(matches);
  const visibleIdeas = ideaRows.filter(matches);
  const visibleSheets = sheetRows.filter(matches);
  const filtering = bookFilter !== 'all' || query !== '';

  const renderContext = (row: VersionRow): ReactNode => {
    if (row.missing) {
      return (
        <span className={`${pill} border-red-900/40 bg-red-950/40 text-red-300`}>
          Parent introuvable
        </span>
      );
    }

    const book = bookLabel(row);
    const category = row.categoryId != null ? categoryById.get(row.categoryId) : undefined;
    const sheet = row.sheetId != null ? sheetNameById.get(row.sheetId) : undefined;

    return (
      <>
        {book ? (
          <span className={`${pill} border-amber-800/40 bg-amber-950 text-amber-300`} title={book}>
            <IconBooks className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[10rem] sm:max-w-[13rem]">{book}</span>
          </span>
        ) : (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200/70`}>
            <IconGlobe className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{row.kind === 'chapter' ? 'Roman inconnu' : 'Carnet global'}</span>
          </span>
        )}

        {row.kind === 'chapter' && row.chapterNumber != null && (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200`}>
            Chap {row.chapterNumber}
          </span>
        )}

        {(row.kind === 'idea' || row.kind === 'sheet') && category && (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200`} title={category.name}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="truncate max-w-[9rem] sm:max-w-[11rem]">{category.name}</span>
          </span>
        )}

        {row.kind === 'idea' && row.sheetId != null && (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200`} title={sheet ?? 'Fiche introuvable'}>
            <IconSheet className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[9rem] sm:max-w-[11rem]">{sheet ?? 'Fiche introuvable'}</span>
          </span>
        )}

        {row.kind === 'idea' && row.sheetId == null && (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200/60`}>Note libre</span>
        )}
      </>
    );
  };

  const stats = [
    { label: 'Chapitres', value: visibleChapters.length },
    { label: 'Idées', value: visibleIdeas.length },
    { label: 'Fiches', value: visibleSheets.length },
    { label: 'Total', value: visibleChapters.length + visibleIdeas.length + visibleSheets.length },
  ];

  const inputClass =
    'w-full rounded-xl border border-amber-900/30 bg-neutral-900 px-3 sm:px-4 py-2.5 sm:py-3 text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm sm:text-base';

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#1c1411] text-[#fcf9f2] font-serif overflow-x-hidden">
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-10 space-y-5 sm:space-y-8">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-200/40 mb-1 sm:mb-2">
              Administration
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold text-amber-100">Versions</h1>
            <p className="text-sm sm:text-base text-amber-200/55 mt-1 sm:mt-2 max-w-2xl">
              Explorez les dossiers de versions des chapitres, des idées et des fiches, et comparez leurs révisions.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/60 p-3 sm:p-6 shadow-xl"
            >
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.28em] text-amber-200/40 mb-1 sm:mb-2 truncate">
                {stat.label}
              </div>
              <div className="text-2xl sm:text-4xl font-bold text-amber-100">{stat.value}</div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/55 p-3 sm:p-5 shadow-xl">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto] sm:items-end">
            <div>
              <label className="block text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40 mb-1.5">
                Rechercher
              </label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Titre, roman, catégorie, fiche..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40 mb-1.5">
                Roman
              </label>
              <select
                value={bookFilter}
                onChange={(event) => setBookFilter(event.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="all">Tous les romans</option>
                <option value="none">Sans roman (carnet global)</option>
                {[...loaded.books]
                  .sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))
                  .map((book) => (
                    <option key={book.id} value={String(book.id)}>
                      {book.title}
                    </option>
                  ))}
              </select>
            </div>
            {filtering && (
              <button
                onClick={() => {
                  setSearch('');
                  setBookFilter('all');
                }}
                className="rounded-xl border border-amber-900/30 bg-neutral-900 px-4 py-2.5 sm:py-3 text-sm font-medium text-amber-200 transition-colors hover:bg-neutral-800 cursor-pointer"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/55 p-6 sm:p-8 text-amber-200/60 shadow-xl">
            Chargement du tableau des versions...
          </div>
        ) : error ? (
          <div className="rounded-2xl sm:rounded-3xl border border-red-900/30 bg-red-950/20 p-6 sm:p-8 text-red-200 shadow-xl">
            {error}
          </div>
        ) : (
          <>
            <VersionsSection
              title="Versions des chapitres"
              subtitle="Cliquez sur un chapitre pour déplier ses versions et les comparer"
              tag="Chapter versions"
              emptyLabel={filtering ? 'Aucune version de chapitre ne correspond.' : 'Aucune version de chapitre.'}
              contextLabel="Roman / chapitre"
              rows={visibleChapters}
              renderContext={renderContext}
              onOpen={navigate}
              onDelete={handleDeleteVersion}
              onComparePair={(parentTitle, versionA, versionB) =>
                setActiveCompare({ parentTitle, versionA, versionB })
              }
            />

            <VersionsSection
              title="Versions des idées"
              subtitle="Cliquez sur une idée pour déplier ses versions et les comparer"
              tag="Idea versions"
              emptyLabel={filtering ? 'Aucune version d’idée ne correspond.' : 'Aucune version d’idée.'}
              contextLabel="Roman / catégorie / fiche"
              rows={visibleIdeas}
              renderContext={renderContext}
              onOpen={navigate}
              onDelete={handleDeleteVersion}
              onComparePair={(parentTitle, versionA, versionB) =>
                setActiveCompare({ parentTitle, versionA, versionB })
              }
            />

            <VersionsSection
              title="Versions des fiches"
              subtitle="Cliquez sur une fiche pour déplier ses versions et comparer leurs cartes"
              tag="Sheet versions"
              emptyLabel={filtering ? 'Aucune version de fiche ne correspond.' : 'Aucune version de fiche.'}
              contextLabel="Roman / catégorie"
              rows={visibleSheets}
              renderContext={renderContext}
              onOpen={navigate}
              onDelete={handleDeleteVersion}
              onComparePair={(parentTitle, versionA, versionB) =>
                setActiveCompare({ parentTitle, versionA, versionB })
              }
            />
          </>
        )}
      </main>

      {activeCompare && (
        <HubCompareModal
          parentTitle={activeCompare.parentTitle}
          versionA={activeCompare.versionA}
          versionB={activeCompare.versionB}
          onClose={() => setActiveCompare(null)}
          onOpenVersion={(path) => {
            setActiveCompare(null);
            navigate(path);
          }}
        />
      )}
    </div>
  );
}

export default VersionsHubPage;