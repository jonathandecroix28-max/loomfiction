import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { offlineChapterService } from '../services/offlineChapterService';
import { offlineChapterVersionService } from '../services/offlineChapterVersionService';
import { offlineIdeaService } from '../services/offlineIdeaService';
import { offlineIdeaVersionService } from '../services/offlineIdeaVersionService';
import { offlineBookService } from '../services/offlineBookService';
import { useCategories } from '../modules/categories/hooks/useCategories';
import { useSheets } from '../modules/sheets/hooks/useSheets';
import type { BookResponse } from '../types/book';
import type { ChapterResponse } from '../types/chapter';
import type { ChapterVersionResponse } from '../types/chapterVersion';
import type { IdeaResponse } from '../types/idea';
import type { IdeaVersionResponse } from '../types/ideaVersion';

interface VersionRow {
  key: string;
  versionId: number;
  kind: 'chapter' | 'idea';
  versionNumber: number | string;
  versionName: string;
  updatedAt: string;
  parentTitle: string;
  missing: boolean;
  bookId: number | null;
  chapterNumber?: number;
  categoryId?: number | null;
  sheetId?: number | null;
  openPath: string | null;
}

interface Loaded {
  books: BookResponse[];
  chapters: { version: ChapterVersionResponse; chapter: ChapterResponse | null }[];
  ideas: { version: IdeaVersionResponse; idea: IdeaResponse | null }[];
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

const pill = 'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium';

type VersionsSectionProps = {
  title: string;
  subtitle: string;
  tag: string;
  emptyLabel: string;
  contextLabel: string;
  rows: VersionRow[];
  renderContext: (row: VersionRow) => ReactNode;
  onOpen: (path: string) => void;
  onDelete: (row: VersionRow) => void;
};

function VersionsSection({ title, subtitle, tag, emptyLabel, contextLabel, rows, renderContext, onOpen, onDelete }: VersionsSectionProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(rows.length / pageSize);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const actionButtons = (row: VersionRow, className = '') => (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => row.openPath && onOpen(row.openPath)}
        disabled={!row.openPath}
        className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {row.openPath ? 'Ouvrir' : 'Introuvable'}
      </button>
      <button
        onClick={() => onDelete(row)}
        className="px-2.5 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/80 text-red-400 border border-red-900/30 text-xs transition-colors cursor-pointer"
        title="Supprimer cette version"
      >
        🗑️
      </button>
    </div>
  );

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/55 shadow-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-amber-900/20 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-amber-100">{title}</h2>
          <p className="text-xs sm:text-sm text-amber-200/50">{subtitle}</p>
        </div>
        <div className="hidden sm:block text-xs text-amber-200/40 uppercase tracking-[0.22em] shrink-0">{tag}</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-amber-200/60">{emptyLabel}</div>
      ) : (
        <>
          <ul className="md:hidden divide-y divide-amber-900/10">
            {paginatedRows.map((row) => (
              <li key={row.key} className="p-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="mt-0.5 inline-flex h-9 min-w-9 px-1.5 shrink-0 items-center justify-center rounded-full border border-amber-800/40 bg-amber-950 text-amber-300 text-xs font-bold">
                    v{row.versionNumber}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="font-semibold text-amber-100 truncate">{row.parentTitle}</div>
                    <div className="flex flex-wrap gap-1.5">{renderContext(row)}</div>
                    <div className="text-[11px] text-amber-200/50">
                      {new Date(row.updatedAt).toLocaleDateString()}
                      {row.versionName && ` · ${row.versionName}`}
                    </div>
                  </div>
                </div>
                {actionButtons(row, 'shrink-0 self-end sm:self-auto')}
              </li>
            ))}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-amber-900/20">
              <thead className="bg-neutral-950/80">
                <tr className="text-left text-xs uppercase tracking-[0.22em] text-amber-200/40">
                  <th className="px-5 py-4 font-medium">Nom</th>
                  <th className="px-5 py-4 font-medium">{contextLabel}</th>
                  <th className="px-5 py-4 font-medium">Version</th>
                  <th className="px-5 py-4 font-medium">Mise à jour</th>
                  <th className="px-5 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-900/10">
                {paginatedRows.map((row) => (
                  <tr key={row.key} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="px-5 py-4 max-w-xs">
                      <div className="font-semibold text-amber-100 truncate">{row.parentTitle}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">{renderContext(row)}</div>
                    </td>
                    <td className="px-5 py-4 text-amber-100 whitespace-nowrap">
                      v{row.versionNumber}
                      {row.versionName && <div className="max-w-40 truncate text-xs text-amber-200/40">{row.versionName}</div>}
                    </td>
                    <td className="px-5 py-4 text-amber-200/70 text-sm whitespace-nowrap">
                      {new Date(row.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">{actionButtons(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-amber-900/20 flex items-center justify-between">
              <span className="text-xs text-amber-200/50">
                Page {page} sur {totalPages} ({rows.length} résultats)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-200/80 text-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-200/80 text-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function VersionsHubPage() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const { sheets } = useSheets();

  const [loaded, setLoaded] = useState<Loaded>({ books: [], chapters: [], ideas: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [bookFilter, setBookFilter] = useState('all');

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
        setLoaded({ books: books ?? [], chapters, ideas });
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
    if (!window.confirm('Voulez-vous vraiment supprimer définitivement cette version ? Cette action est irréversible.')) {
      return;
    }

    try {
      if (row.kind === 'chapter') {
        await offlineChapterVersionService.remove(row.versionId);
        setLoaded((prev) => ({
          ...prev,
          chapters: prev.chapters.filter((c) => c.version.id !== row.versionId),
        }));
      } else {
        await offlineIdeaVersionService.remove(row.versionId);
        setLoaded((prev) => ({
          ...prev,
          ideas: prev.ideas.filter((i) => i.version.id !== row.versionId),
        }));
      }
    } catch (err) {
      console.error('Erreur lors de la suppression de la version :', err);
      alert('Impossible de supprimer la version.');
    }
  };

  const bookTitleById = useMemo(() => new Map(loaded.books.map((book) => [book.id, book.title] as const)), [loaded.books]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category] as const)), [categories]);
  const sheetNameById = useMemo(() => new Map(sheets.map((sheet) => [sheet.id, sheet.name] as const)), [sheets]);

  const byNewest = (a: VersionRow, b: VersionRow) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

  const chapterRows = useMemo<VersionRow[]>(
    () =>
      loaded.chapters
        .map(({ version, chapter }): VersionRow => ({
          key: `chapter-${version.id}`,
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
        }))
        .sort(byNewest),
    [loaded.chapters]
  );

  const ideaRows = useMemo<VersionRow[]>(
    () =>
      loaded.ideas
        .map(({ version, idea }): VersionRow => ({
          key: `idea-${version.id}`,
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
        }))
        .sort(byNewest),
    [loaded.ideas]
  );

  const bookLabel = (row: VersionRow): string | null => (row.bookId == null ? null : bookTitleById.get(row.bookId) ?? 'Roman introuvable');

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
    return fold([row.parentTitle, row.versionName, bookLabel(row) ?? '', category ?? '', sheet ?? ''].join('\n')).includes(query);
  };

  const visibleChapters = chapterRows.filter(matches);
  const visibleIdeas = ideaRows.filter(matches);
  const filtering = bookFilter !== 'all' || query !== '';

  const renderContext = (row: VersionRow): ReactNode => {
    if (row.missing) {
      return (
        <span className={`${pill} border-red-900/40 bg-red-950/40 text-red-300`}>
          Parent introuvable : l'origine de cette version est perdue
        </span>
      );
    }

    const book = bookLabel(row);
    const category = row.categoryId != null ? categoryById.get(row.categoryId) : undefined;
    const sheet = row.sheetId != null ? sheetNameById.get(row.sheetId) : undefined;

    return (
      <>
        {book ? (
          <span className={`${pill} border-amber-800/40 bg-amber-950 text-amber-300`}>
            <span aria-hidden>📚</span>
            <span className="truncate">{book}</span>
          </span>
        ) : (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200/70`}>
            <span aria-hidden>🌐</span>
            {row.kind === 'chapter' ? 'Roman inconnu' : 'Carnet global'}
          </span>
        )}

        {row.kind === 'chapter' && row.chapterNumber != null && (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200`}>Chapitre {row.chapterNumber}</span>
        )}

        {row.kind === 'idea' && category && (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200`}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="truncate">{category.name}</span>
          </span>
        )}

        {row.kind === 'idea' && row.sheetId != null && (
          <span className={`${pill} border-amber-900/30 bg-neutral-900 text-amber-200`}>
            <span aria-hidden>🗂️</span>
            <span className="truncate">{sheet ?? 'Fiche introuvable'}</span>
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
    { label: 'Total', value: visibleChapters.length + visibleIdeas.length },
  ];

  const inputClass =
    'w-full rounded-xl border border-amber-900/30 bg-neutral-900 px-3 sm:px-4 py-2.5 sm:py-3 text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500';

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#1c1411] text-[#fcf9f2] font-serif overflow-x-hidden">
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-10 space-y-5 sm:space-y-8">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-200/40 mb-1 sm:mb-2">Administration</p>
            <h1 className="text-2xl sm:text-4xl font-bold text-amber-100">Versions</h1>
            <p className="text-sm sm:text-base text-amber-200/55 mt-1 sm:mt-2 max-w-2xl">
              Accédez aux tableaux de versions pour les chapitres et les idées depuis un point d’entrée unique.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 sm:gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/60 p-3 sm:p-6 shadow-xl">
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
              <label className="block text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40 mb-1.5">Rechercher</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Titre, roman, catégorie, fiche..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40 mb-1.5">Roman</label>
              <select value={bookFilter} onChange={(event) => setBookFilter(event.target.value)} className={`${inputClass} cursor-pointer`}>
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
              subtitle="Accès direct à chaque chapitre et à son historique"
              tag="Chapter versions"
              emptyLabel={filtering ? 'Aucune version de chapitre ne correspond.' : 'Aucune version de chapitre.'}
              contextLabel="Roman / chapitre"
              rows={visibleChapters}
              renderContext={renderContext}
              onOpen={navigate}
              onDelete={handleDeleteVersion}
            />

            <VersionsSection
              title="Versions des idées"
              subtitle="Accès direct à chaque idée et à son historique"
              tag="Idea versions"
              emptyLabel={filtering ? 'Aucune version d’idée ne correspond.' : 'Aucune version d’idée.'}
              contextLabel="Roman / catégorie / fiche"
              rows={visibleIdeas}
              renderContext={renderContext}
              onOpen={navigate}
              onDelete={handleDeleteVersion}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default VersionsHubPage;