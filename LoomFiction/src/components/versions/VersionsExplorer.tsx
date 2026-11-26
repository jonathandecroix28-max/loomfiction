import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BookResponse } from '../../types/book';
import type { ChapterResponse } from '../../types/chapter';
import type { ChapterVersionResponse } from '../../types/chapterVersion';
import type { SheetResponse } from '../../types/sheet';
import type { SheetVersion } from '../../types/sheetVersion';
import type { IdeaResponse } from '../../types/idea';
import type { IdeaVersionResponse } from '../../types/ideaVersion';
import { offlineBookService } from '../../services/offlineBookService';
import { offlineChapterService } from '../../services/offlineChapterService';
import { offlineChapterVersionService } from '../../services/offlineChapterVersionService';
import { offlineSheetService } from '../../services/offlineSheetService';
import { offlineSheetVersionService } from '../../services/offlineSheetVersionService';
import { offlineIdeaService } from '../../services/offlineIdeaService';
import { offlineIdeaVersionService } from '../../services/offlineIdeaVersionService';
import { useDataChanged } from '../../hooks/useDataChanged';
import { IconBooks, IconChevronRight, IconClose, IconFile, IconHistory, IconIdea, IconSheet } from '../icons';
import { ExplorerNav } from '../explorer/ExplorerNav';
import {
  ExplorerFooter,
  ExplorerSearch,
  ExplorerToolbar,
  PANEL_MESSAGE,
  ROW_ACTION,
  SCROLL,
  ToolbarButton,
  TREE_BRANCH,
  TREE_COUNT,
  TREE_EMPTY,
  TREE_SECTION,
  VersionLeaf,
} from '../explorer/ExplorerParts';
import { row, rowMain, rowShell } from '../explorer/explorerRows';
import '../diff/diff.css';


export type VersionKind = 'chapter' | 'sheet' | 'idea' | 'hub';

export type SelectedVersionItem =
  | { kind: 'chapter'; version: ChapterVersionResponse }
  | { kind: 'sheet'; version: SheetVersion }
  | { kind: 'idea'; version: IdeaVersionResponse };

interface VersionsExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  kind: VersionKind;
  parentId: number | null;
  bookId?: number | null;
  selectedVersionId?: number | null;
  onSelectVersion?: (item: SelectedVersionItem) => void;
  embedded?: boolean;
}

type GroupKind = Exclude<VersionKind, 'hub'>;

interface Leaf {
  id: number;
  number: number;
  name: string;
  date: string;
  item: SelectedVersionItem;
  path: string | null;
}

interface Folder {
  key: string;
  kind: GroupKind;
  parentId: number;
  title: string;
  section: string;
  order: number;
  listPath: string | null;
  leaves: Leaf[];
}

interface Data {
  books: BookResponse[];
  chapters: ChapterResponse[];
  chapterVersions: ChapterVersionResponse[];
  sheets: SheetResponse[];
  sheetVersions: SheetVersion[];
  ideas: IdeaResponse[];
  ideaVersions: IdeaVersionResponse[];
}

const EMPTY_DATA: Data = {
  books: [],
  chapters: [],
  chapterVersions: [],
  sheets: [],
  sheetVersions: [],
  ideas: [],
  ideaVersions: [],
};

const GROUPS: {
  kind: GroupKind;
  label: string;
  Icon: typeof IconBooks;
  ItemIcon: typeof IconBooks;
  empty: string;
}[] = [
  { kind: 'chapter', label: 'Chapitres', Icon: IconBooks, ItemIcon: IconFile, empty: 'Aucun chapitre avec des versions.' },
  { kind: 'sheet', label: 'Fiches', Icon: IconSheet, ItemIcon: IconSheet, empty: 'Aucune fiche avec des versions.' },
  { kind: 'idea', label: 'Idées', Icon: IconIdea, ItemIcon: IconIdea, empty: 'Aucune idée avec des versions.' },
];

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

const safe = <T,>(promise: Promise<T[] | null | undefined>) =>
  promise.then((data) => ({ data: data ?? [], ok: true })).catch(() => ({ data: [] as T[], ok: false }));

function groupBy<V extends { versionNumber: number }>(versions: V[], parentOf: (version: V) => number) {
  const map = new Map<number, V[]>();
  for (const version of versions) {
    const key = parentOf(version);
    map.set(key, [...(map.get(key) ?? []), version]);
  }
  map.forEach((list) => list.sort((a, b) => b.versionNumber - a.versionNumber));
  return map;
}

export function VersionsExplorer({
  isOpen,
  onClose,
  kind,
  parentId,
  bookId = null,
  selectedVersionId = null,
  onSelectVersion,
  embedded = false,
}: VersionsExplorerProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<Data>(EMPTY_DATA);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [failed, setFailed] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [appliedAutoExpandKey, setAppliedAutoExpandKey] = useState('');

  const listRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /* ───────────── Chargement ───────────── */

  const loadAll = useCallback(async () => {
    const request = ++requestRef.current;

    const [books, chapterVersions, sheets, sheetVersions, ideas, ideaVersions] = await Promise.all([
      safe(offlineBookService.getAll()),
      safe(offlineChapterVersionService.getAll()),
      safe(offlineSheetService.getAll()),
      safe(offlineSheetVersionService.getAll()),
      safe(offlineIdeaService.getAll()),
      safe(offlineIdeaVersionService.getAll()),
    ]);
    const chapterLists = await Promise.all(books.data.map((book) => safe(offlineChapterService.getByBookId(book.id))));
    if (request !== requestRef.current) return;

    setData({
      books: books.data,
      chapters: chapterLists.flatMap((list) => list.data),
      chapterVersions: chapterVersions.data,
      sheets: sheets.data,
      sheetVersions: sheetVersions.data,
      ideas: ideas.data,
      ideaVersions: ideaVersions.data,
    });
    setFailed(![books, chapterVersions, sheets, sheetVersions, ideas, ideaVersions, ...chapterLists].every((r) => r.ok));
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (isOpen) void loadAll();
  }, [isOpen, loadAll]);

  useEffect(
    () => () => {
      requestRef.current++;
    },
    [],
  );

  useDataChanged((source) => {
    if (!isOpen || source === 'versions-explorer') return;
    void loadAll();
  });

  useEffect(() => {
    if (!isOpen || embedded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, embedded]);

  /* ───────────── Dossiers ───────────── */

  const folders = useMemo(() => {
    const bookTitle = new Map(data.books.map((book) => [book.id, book.title]));
    const sortFolders = (list: Folder[]) =>
      list.sort((a, b) => collator.compare(a.section, b.section) || a.order - b.order || collator.compare(a.title, b.title));

    const chapters: Folder[] = [];
    const chapterById = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
    groupBy(data.chapterVersions, (version) => version.chapterId).forEach((versions, chapterId) => {
      const chapter = chapterById.get(chapterId);
      const chapterBook = chapter ? Number(chapter.book_id) : null;
      const base = chapterBook !== null ? `/books/${chapterBook}/chapters/${chapterId}/versions` : null;
      chapters.push({
        key: `chapter-${chapterId}`,
        kind: 'chapter',
        parentId: chapterId,
        title: chapter ? `Ch. ${chapter.chapter_number} · ${chapter.title}` : `Chapitre n° ${chapterId}`,
        section: chapterBook !== null ? (bookTitle.get(chapterBook) ?? `Roman n° ${chapterBook}`) : 'Roman introuvable',
        order: chapter ? chapter.chapter_number : Number.MAX_SAFE_INTEGER,
        listPath: base,
        leaves: versions.map((version) => ({
          id: version.id,
          number: version.versionNumber,
          name: version.name ?? '',
          date: version.updatedAt || version.createdAt,
          item: { kind: 'chapter', version },
          path: base ? `${base}/${version.id}` : null,
        })),
      });
    });

    const sheets: Folder[] = [];
    const sheetById = new Map(data.sheets.map((sheet) => [sheet.id, sheet]));
    groupBy(data.sheetVersions, (version) => version.sheetId).forEach((versions, sheetId) => {
      const base = `/ideas/fiches/${sheetId}/versions`;
      sheets.push({
        key: `sheet-${sheetId}`,
        kind: 'sheet',
        parentId: sheetId,
        title: sheetById.get(sheetId)?.name ?? versions[0]?.name ?? `Fiche n° ${sheetId}`,
        section: '',
        order: 0,
        listPath: base,
        leaves: versions.map((version) => ({
          id: version.id,
          number: version.versionNumber,
          name: version.name ?? '',
          date: version.updatedAt,
          item: { kind: 'sheet', version },
          path: `${base}/${version.id}`,
        })),
      });
    });

    const ideas: Folder[] = [];
    const ideaById = new Map(data.ideas.map((idea) => [idea.id, idea]));
    groupBy(data.ideaVersions, (version) => version.ideaId).forEach((versions, ideaId) => {
      const idea = ideaById.get(ideaId);
      const ideaBook = idea?.bookId ?? null;
      const base = `/ideas/${ideaId}/versions`;
      ideas.push({
        key: `idea-${ideaId}`,
        kind: 'idea',
        parentId: ideaId,
        title: idea?.name ?? versions[0]?.name ?? `Idée n° ${ideaId}`,
        section: ideaBook !== null ? (bookTitle.get(ideaBook) ?? `Roman n° ${ideaBook}`) : 'Sans roman',
        order: 0,
        listPath: base,
        leaves: versions.map((version) => ({
          id: version.id,
          number: version.versionNumber,
          name: version.name ?? '',
          date: version.updatedAt,
          item: { kind: 'idea', version },
          path: `${base}/${version.id}`,
        })),
      });
    });

    return { chapter: sortFolders(chapters), sheet: sortFolders(sheets), idea: sortFolders(ideas) };
  }, [data]);

  const totalVersions = data.chapterVersions.length + data.sheetVersions.length + data.ideaVersions.length;
  const query = filterQuery.trim().toLowerCase();

  /** Pendant une recherche, seuls les dossiers et versions qui correspondent restent affichés. */
  const groups = useMemo(
    () =>
      GROUPS.map((group) => {
        const list = folders[group.kind];
        if (!query) return { ...group, folders: list };
        const narrowed = list.flatMap((folder) => {
          if (`${folder.title} ${folder.section}`.toLowerCase().includes(query)) return [folder];
          const leaves = folder.leaves.filter((leaf) => `v${leaf.number} ${leaf.name}`.toLowerCase().includes(query));
          return leaves.length > 0 ? [{ ...folder, leaves }] : [];
        });
        return { ...group, folders: narrowed };
      }),
    [folders, query],
  );
  const hasResults = groups.some((group) => group.folders.length > 0);

  /* ───────────── Dépliage ───────────── */

  const autoExpandKey = isOpen ? `${kind}|${parentId ?? ''}|${bookId ?? ''}` : '';
  if (autoExpandKey !== appliedAutoExpandKey) {
    setAppliedAutoExpandKey(autoExpandKey);
    if (autoExpandKey) {
      setExpanded((current) => ({
        ...current,
        'group-chapter': true,
        'group-sheet': true,
        'group-idea': true,
        ...(kind !== 'hub' && parentId !== null ? { [`${kind}-${parentId}`]: true } : {}),
      }));
    }
  }

  const toggle = (key: string) => setExpanded((current) => ({ ...current, [key]: !current[key] }));

  useEffect(() => {
    if (!isOpen || status !== 'ready') return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, status, kind, parentId, selectedVersionId]);

  /* ───────────── Navigation ───────────── */

  const closeOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) onClose();
  };

  const go = (path: string) => {
    navigate(path);
    closeOnMobile();
  };

  const selectLeaf = (folder: Folder, leaf: Leaf) => {
    if (kind === folder.kind && parentId === folder.parentId && onSelectVersion) {
      onSelectVersion(leaf.item);
      closeOnMobile();
      return;
    }
    if (leaf.path) go(leaf.path);
  };

  /* ───────────── Rendu ───────────── */

  const renderFolder = (folder: Folder, ItemIcon: typeof IconBooks) => {
    const isCurrentFolder = kind === folder.kind && parentId === folder.parentId;
    const isOpenFolder = query ? true : !!expanded[folder.key];

    return (
      <div key={folder.key} className="flex flex-col">
        <div className={rowShell('l2', isCurrentFolder)}>
          <button
            type="button"
            onClick={() => toggle(folder.key)}
            aria-expanded={isOpenFolder}
            className={rowMain('l2')}
          >
            <IconChevronRight
              className={`size-3.5 shrink-0 text-amber-400/60 transition-transform ${isOpenFolder ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
            <ItemIcon className="size-3.5 shrink-0 text-amber-500/80" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate" title={folder.title}>
              {folder.title}
            </span>
            <span className={TREE_COUNT}>{folder.leaves.length}</span>
          </button>
          {folder.listPath && !isCurrentFolder && (
            <button
              type="button"
              onClick={() => go(folder.listPath!)}
              title="Ouvrir l’historique de ce dossier"
              aria-label={`Ouvrir l’historique de ${folder.title}`}
              className={ROW_ACTION}
            >
              <IconHistory className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {isOpenFolder && (
          <ul className={TREE_BRANCH}>
            {folder.leaves.map((leaf) => {
              const active = isCurrentFolder && leaf.id === selectedVersionId;
              const blocked = !leaf.path && !(isCurrentFolder && onSelectVersion);
              return (
                <li key={leaf.id}>
                  <VersionLeaf
                    number={leaf.number}
                    name={leaf.name}
                    date={leaf.date}
                    active={active}
                    disabled={blocked}
                    title={blocked ? 'Roman introuvable : cette version ne peut pas être ouverte.' : undefined}
                    onSelect={() => selectLeaf(folder, leaf)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const content = (
    <>
        {!embedded && <ExplorerNav />}

        <ExplorerToolbar title="Historique des versions">
          {!embedded && (
            <ToolbarButton onClick={onClose} title="Fermer l’explorateur (Échap)" label="Fermer l’explorateur">
              <IconClose className="size-4" aria-hidden="true" />
            </ToolbarButton>
          )}
        </ExplorerToolbar>

        <ExplorerSearch
          value={filterQuery}
          onChange={setFilterQuery}
          placeholder="Filtrer : nom, roman, v3…"
          label="Filtrer les versions"
        />

        <div ref={listRef} className={SCROLL}>
          {failed && (
            <div className="mx-1 mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 font-sans text-xs text-red-200">
              <span>Certaines données n’ont pas pu être chargées.</span>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="shrink-0 cursor-pointer rounded-md border border-red-900/50 px-2 py-1 transition-colors hover:bg-red-900/30"
              >
                Réessayer
              </button>
            </div>
          )}

          {status === 'loading' ? (
            <p className={PANEL_MESSAGE}>Chargement des versions…</p>
          ) : query && !hasResults ? (
            <div className={PANEL_MESSAGE}>
              Aucun résultat pour « {filterQuery.trim()} ».
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="mt-2 block w-full cursor-pointer text-amber-300 underline-offset-2 hover:underline"
              >
                Effacer le filtre
              </button>
            </div>
          ) : (
            groups.map(({ kind: groupKind, label, Icon, ItemIcon, empty, folders: list }) => {
              const groupKey = `group-${groupKind}`;
              const groupOpen = query ? true : !!expanded[groupKey];
              const versionCount = list.reduce((sum, folder) => sum + folder.leaves.length, 0);
              return (
                <div key={groupKey} className="mb-1 flex flex-col">
                  <button
                    type="button"
                    onClick={() => toggle(groupKey)}
                    aria-expanded={groupOpen}
                    className={row('l1')}
                  >
                    <IconChevronRight
                      className={`size-4 shrink-0 text-amber-400/60 transition-transform ${groupOpen ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                    <Icon className="size-4 shrink-0 text-amber-500/90" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                    <span className={TREE_COUNT}>{versionCount}</span>
                  </button>

                  {groupOpen && (
                    <div className={TREE_BRANCH}>
                      {list.length === 0 ? (
                        <p className={TREE_EMPTY}>{empty}</p>
                      ) : (
                        list.map((folder, index) => (
                          <Fragment key={folder.key}>
                            {folder.section && folder.section !== list[index - 1]?.section && (
                              <div className={TREE_SECTION} title={folder.section}>
                                {folder.section}
                              </div>
                            )}
                            {renderFolder(folder, ItemIcon)}
                          </Fragment>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <ExplorerFooter>{totalVersions} version{totalVersions > 1 ? 's' : ''} au total</ExplorerFooter>
    </>
  );

  if (embedded) {
    return <div className={`flex min-h-0 flex-1 flex-col font-sans ${isOpen ? '' : 'hidden'}`}>{content}</div>;
  }

  return (
    <>
      {/* Voile derrière le tiroir (mobile) */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[65] bg-[var(--c-overlay)] transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        aria-label="Explorateur des versions"
        aria-hidden={!isOpen}
        className={`loom fixed inset-y-0 left-0 z-[70] md:z-40 flex w-[min(88vw,21rem)] shrink-0 flex-col border-r border-amber-900/40 bg-[var(--c-surface)] shadow-2xl transition-[transform,visibility] duration-300 ease-in-out md:sticky md:top-[var(--nav-top,0px)] md:bottom-auto md:left-auto md:h-[calc(100dvh-var(--nav-top,0px))] md:w-80 md:translate-x-0 md:self-start md:shadow-none ${
          isOpen ? 'visible translate-x-0' : 'invisible pointer-events-none -translate-x-full md:hidden'
        }`}
      >
                {content}
      </aside>
    </>
  );
}

export default VersionsExplorer;