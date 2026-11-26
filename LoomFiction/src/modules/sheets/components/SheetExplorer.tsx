import { useEffect, useMemo, useRef, useState } from 'react';
import { ExplorerNav } from '../../../components/explorer/ExplorerNav';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../../categories/hooks/useCategories';
import { useSheets } from '../../sheets/hooks/useSheets';
import { offlineBookService } from '../../../services/offlineBookService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineSheetVersionService } from '../../../services/offlineSheetVersionService';
import { offlineIdeaVersionService } from '../../../services/offlineIdeaVersionService';
import { offlineChapterService } from '../../../services/offlineChapterService';
import type { BookResponse } from '../../../types/book';
import type { ChapterResponse } from '../../../types/chapter';
import type { SheetResponse } from '../../../types/sheet';
import type { IdeaResponse } from '../../../types/idea';
import type { SheetVersionResponse } from '../../../types/sheetVersion';
import type { IdeaVersionResponse } from '../../../types/ideaVersion';
import {
  IconChevronRight,
  IconClose,
  IconSheet,
  IconBooks,
  IconIdea,
  IconFile,
  IconHistory,
  IconAdd,
  IconUp,
  IconDown,
} from '../../../components/icons';
import { bookOfSheet } from '../sheetLinks';
import { useToast } from '../../../components/feedback/FeedbackProvider';
import { notifyDataChanged, useDataChanged } from '../../../hooks/useDataChanged';
import { ExplorerFooter, ExplorerToolbar, INPUT, ROW_ACTION, SCROLL, ToolbarButton, TREE_BRANCH, TREE_COUNT, TREE_EMPTY, VersionLeaf } from '../../../components/explorer/ExplorerParts';
import { row, rowMain, rowShell } from '../../../components/explorer/explorerRows';

type ChapterEntry = { chapter: ChapterResponse; bookId: number };

type SheetExplorerProps = {
  isOpen: boolean;
  onClose: () => void;
  currentSheetId: number | null;
  onSelectSheetVersion?: (version: SheetVersionResponse) => void;
  onSelectIdeaVersion?: (version: IdeaVersionResponse) => void;
  embedded?: boolean;
};

type IdeaExplorerMeta = IdeaResponse & {
  bookId?: number | null;
  categoryId?: number | null;
};

export function SheetExplorer({
  isOpen,
  onClose,
  currentSheetId,
  onSelectSheetVersion,
  onSelectIdeaVersion,
  embedded = false,
}: SheetExplorerProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, createCategory } = useCategories();
  const { sheets, refreshSheets } = useSheets();

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [ideas, setIdeas] = useState<IdeaResponse[]>([]);
  const [sheetVersions, setSheetVersions] = useState<SheetVersionResponse[]>([]);
  const [ideaVersions, setIdeaVersions] = useState<IdeaVersionResponse[]>([]);
  const [chapterEntries, setChapterEntries] = useState<ChapterEntry[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const [isCreatingBook, setIsCreatingBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const bookInputRef = useRef<HTMLInputElement>(null);

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const [creatingSheetInFolderKey, setCreatingSheetInFolderKey] = useState<string | null>(null);
  const [newSheetName, setNewSheetName] = useState('');
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const [creatingIdeaInFolderKey, setCreatingIdeaInFolderKey] = useState<string | null>(null);
  const [newIdeaName, setNewIdeaName] = useState('');
  const ideaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingBook && bookInputRef.current) bookInputRef.current.focus();
  }, [isCreatingBook]);

  useEffect(() => {
    if (isCreatingCategory && categoryInputRef.current) categoryInputRef.current.focus();
  }, [isCreatingCategory]);

  useEffect(() => {
    if (creatingSheetInFolderKey && sheetInputRef.current) sheetInputRef.current.focus();
  }, [creatingSheetInFolderKey]);

  useEffect(() => {
    if (creatingIdeaInFolderKey && ideaInputRef.current) ideaInputRef.current.focus();
  }, [creatingIdeaInFolderKey]);

  const loadData = async () => {
    try {
      const [booksData, ideasData, sheetVerData, ideaVerData] = await Promise.all([
        offlineBookService.getAll().catch(() => []),
        offlineIdeaService.getAll().catch(() => []),
        offlineSheetVersionService.getAll().catch(() => []),
        offlineIdeaVersionService.getAll().catch(() => []),
      ]);
      const chapterLists = await Promise.all(
        (booksData || []).map(async (book) => ({
          bookId: book.id,
          chapters: await offlineChapterService.getByBookId(book.id).catch(() => [] as ChapterResponse[]),
        })),
      );
      setChapterEntries(
        chapterLists.flatMap(({ bookId, chapters }) => (chapters ?? []).map((chapter) => ({ chapter, bookId }))),
      );
      setBooks(booksData || []);
      setIdeas(ideasData || []);
      setSheetVersions(sheetVerData || []);
      setIdeaVersions(ideaVerData || []);
    } catch (err) {
      console.error('Erreur lors du chargement des données de l’explorateur :', err);
    }
  };

  useDataChanged((source) => {
    if (source === 'sheet-explorer') return;
    void refreshSheets();
    void loadData();
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Une création en cours est annulée ici : on le signale pour que l'explorateur ne se ferme pas aussi.
        if (isCreatingBook || isCreatingCategory || creatingSheetInFolderKey || creatingIdeaInFolderKey) event.preventDefault();
        if (isCreatingBook) {
          setIsCreatingBook(false);
          setNewBookTitle('');
        } else if (isCreatingCategory) {
          setIsCreatingCategory(false);
          setNewCategoryName('');
        } else if (creatingSheetInFolderKey) {
          setCreatingSheetInFolderKey(null);
          setNewSheetName('');
        } else if (creatingIdeaInFolderKey) {
          setCreatingIdeaInFolderKey(null);
          setNewIdeaName('');
        } else if (!embedded) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, embedded, isCreatingBook, isCreatingCategory, creatingSheetInFolderKey, creatingIdeaInFolderKey]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const fetchAll = async () => {
      await refreshSheets();
      await loadData();
    };

    if (!cancelled) void fetchAll();
    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshSheets]);

  const cardsBySheet = useMemo(() => {
    const map = new Map<number, IdeaResponse[]>();
    for (const idea of ideas) {
      if (idea.sheetId == null) continue;
      const list = map.get(idea.sheetId) ?? [];
      list.push(idea);
      map.set(idea.sheetId, list);
    }
    return map;
  }, [ideas]);

  const freeIdeas = useMemo(
    () => ideas.filter((idea) => idea.sheetId == null),
    [ideas],
  );

  const versionsBySheetId = useMemo(() => {
    const map = new Map<number, SheetVersionResponse[]>();
    for (const version of sheetVersions) {
      const list = map.get(version.sheetId) ?? [];
      list.push(version);
      map.set(version.sheetId, list);
    }
    map.forEach((list) => list.sort((a, b) => b.versionNumber - a.versionNumber));
    return map;
  }, [sheetVersions]);

  const versionsByIdeaId = useMemo(() => {
    const map = new Map<number, IdeaVersionResponse[]>();
    for (const version of ideaVersions) {
      const list = map.get(version.ideaId) ?? [];
      list.push(version);
      map.set(version.ideaId, list);
    }
    map.forEach((list) => list.sort((a, b) => b.versionNumber - a.versionNumber));
    return map;
  }, [ideaVersions]);

  const chaptersBySheetId = useMemo(() => {
    const map = new Map<number, ChapterEntry[]>();
    if (sheets.length === 0 || chapterEntries.length === 0) return map;

    const knownIds = new Set(sheets.map((sheet) => sheet.id));
    const idByName = new Map(sheets.map((sheet) => [sheet.name.trim().toLowerCase(), sheet.id]));

    for (const entry of chapterEntries) {
      const html = entry.chapter.content;
      if (!html || !html.includes('mention')) continue;

      const mentioned = new Set<number>();
      new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelectorAll('[data-type="mention"]')
        .forEach((element) => {
          const rawId = Number((element.getAttribute('data-id') ?? '').replace(/\D/g, ''));
          if (rawId && knownIds.has(rawId)) {
            mentioned.add(rawId);
            return;
          }
          const label = (element.getAttribute('data-label') ?? element.textContent ?? '')
            .replace(/^@/, '')
            .trim()
            .toLowerCase();
          const byName = idByName.get(label);
          if (byName) mentioned.add(byName);
        });

      mentioned.forEach((sheetId) => {
        const list = map.get(sheetId) ?? [];
        list.push(entry);
        map.set(sheetId, list);
      });
    }

    map.forEach((list) =>
      list.sort((a, b) => a.bookId - b.bookId || Number(a.chapter.chapter_number) - Number(b.chapter.chapter_number)),
    );
    return map;
  }, [chapterEntries, sheets]);

  const toggleFolder = (folderKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedFolders((previous) => ({
      ...previous,
      [folderKey]: !previous[folderKey],
    }));
  };

  const closeAfterNavigation = () => {
    if (window.innerWidth < 768) onClose();
  };

  const navigateToSheet = (sheetId: number) => {
    navigate(`/ideas/fiches/${sheetId}`);
    closeAfterNavigation();
  };

  const navigateToIdea = () => {
    navigate('/ideas/libres');
    closeAfterNavigation();
  };

  const handleMoveSheet = async (sheetsList: SheetResponse[], index: number, delta: -1 | 1) => {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= sheetsList.length) return;

    const reordered = [...sheetsList];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    try {
      for (const [newSortOrder, item] of reordered.entries()) {
        const sheetCards = cardsBySheet.get(item.id) ?? [];
        if (sheetCards.length > 0) {
          for (const card of sheetCards) {
            await offlineIdeaService.update(card.id, {
              ...card,
              sortOrder: newSortOrder,
            });
          }
        }
      }
      await refreshSheets();
      await loadData();
      notifyDataChanged('sheet-explorer');
    } catch (err) {
      console.error('Erreur lors du déplacement de la fiche :', err);
      toast.error('Impossible de déplacer la fiche.');
    }
  };

  const handleCreateBookSubmit = async () => {
    const title = newBookTitle.trim();
    if (!title) {
      setIsCreatingBook(false);
      setNewBookTitle('');
      return;
    }
    try {
      await offlineBookService.create(title);
      await refreshSheets();
      await loadData();
      notifyDataChanged('sheet-explorer');
      toast.success(`Roman "${title}" créé`);
    } catch (err) {
      console.error('Erreur création roman :', err);
      toast.error('Impossible de créer le roman.');
    } finally {
      setIsCreatingBook(false);
      setNewBookTitle('');
    }
  };

  const handleCreateCategorySubmit = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setIsCreatingCategory(false);
      setNewCategoryName('');
      return;
    }
    try {
      await createCategory({ name, color: '#d97706' });
      await refreshSheets();
      notifyDataChanged('sheet-explorer');
      toast.success(`Catégorie "${name}" créée`);
    } catch (err) {
      console.error('Erreur création catégorie :', err);
      toast.error('Impossible de créer la catégorie.');
    } finally {
      setIsCreatingCategory(false);
      setNewCategoryName('');
    }
  };

  const handleCreateSheetSubmit = async (categoryId: number, bookId: number | null) => {
    const name = newSheetName.trim();
    if (!name) {
      setCreatingSheetInFolderKey(null);
      setNewSheetName('');
      return;
    }
    try {
      const newSheet = await offlineSheetService.create({ name, categoryId });
      if (newSheet) {
        await offlineIdeaService.create({
          name: `Caractéristique principale`,
          description: '',
          categoryId,
          sheetId: newSheet.id,
          status: 'draft',
          sortOrder: 0,
          bookId: bookId !== null ? bookId : null,
        });
      }
      await refreshSheets();
      await loadData();
      notifyDataChanged('sheet-explorer');
      toast.success(`Fiche "${name}" créée`);
      if (newSheet) {
        navigateToSheet(newSheet.id);
      }
    } catch (err) {
      console.error('Erreur création fiche :', err);
      toast.error('Impossible de créer la fiche.');
    } finally {
      setCreatingSheetInFolderKey(null);
      setNewSheetName('');
    }
  };

  const handleCreateIdeaSubmit = async (categoryId: number, bookId: number | null) => {
    const name = newIdeaName.trim();
    if (!name) {
      setCreatingIdeaInFolderKey(null);
      setNewIdeaName('');
      return;
    }
    try {
      await offlineIdeaService.create({
        name,
        description: '',
        categoryId,
        bookId: bookId !== null ? bookId : null,
        status: 'draft',
      });
      await loadData();
      notifyDataChanged('sheet-explorer');
      toast.success(`Idée "${name}" créée`);
      navigateToIdea();
    } catch (err) {
      console.error('Erreur création idée :', err);
      toast.error('Impossible de créer l’idée.');
    } finally {
      setCreatingIdeaInFolderKey(null);
      setNewIdeaName('');
    }
  };


  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = asideRef.current;
    if (!element) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    let frame = 0;

    const update = () => {
      frame = 0;
      if (!desktop.matches) {
        element.style.height = '';
        return;
      }
      const top = Math.max(0, element.getBoundingClientRect().top);
      element.style.height = `${Math.max(0, window.innerHeight - top)}px`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    desktop.addEventListener('change', schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      desktop.removeEventListener('change', schedule);
      element.style.height = '';
    };
  }, [isOpen]);

  const autoExpandKeys = useMemo(() => {
    if (!isOpen || !currentSheetId || sheets.length === 0) return [];
    const currentSheet = sheets.find((sheet) => sheet.id === currentSheetId);
    if (!currentSheet) return [];

    const bookId = bookOfSheet(cardsBySheet.get(currentSheet.id) ?? []);
    const bookKey = `book-${bookId ?? 'none'}`;
    const categoryKey = `${bookKey}-cat-${currentSheet.categoryId}`;
    return [bookKey, categoryKey, `${categoryKey}-sheets`];
  }, [isOpen, currentSheetId, sheets, cardsBySheet]);

  const autoExpandId = autoExpandKeys.join('|');
  const [appliedAutoExpandId, setAppliedAutoExpandId] = useState('');
  if (autoExpandId !== appliedAutoExpandId) {
    setAppliedAutoExpandId(autoExpandId);
    if (autoExpandKeys.length > 0) {
      setExpandedFolders((previous) => ({
        ...previous,
        ...Object.fromEntries(autoExpandKeys.map((key) => [key, true])),
      }));
    }
  }

  const renderSheetVersions = (groupSheets: SheetResponse[]) => (
    <div className={TREE_BRANCH}>
      {groupSheets.length === 0 || groupSheets.every((sheet) => !(versionsBySheetId.get(sheet.id)?.length)) ? (
        <div className={TREE_EMPTY}>Aucune version de fiche</div>
      ) : (
        groupSheets.map((sheet) => {
          const versions = versionsBySheetId.get(sheet.id) ?? [];
          if (versions.length === 0) return null;
          const key = `sheet-version-group-${sheet.id}`;
          const expanded = !!expandedFolders[key];
          return (
            <div key={key} className="flex flex-col">
              <button
                type="button"
                onClick={(event) => toggleFolder(key, event)}
                aria-expanded={expanded}
                className={row('l3')}
              >
                <IconChevronRight className={`size-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                <IconSheet className="size-3 shrink-0 opacity-60" />
                <span className="truncate">{sheet.name}</span>
                <span className={TREE_COUNT}>{versions.length}</span>
              </button>
              {expanded && (
                <div className={TREE_BRANCH}>
                  {versions.map((version) => (
                    <VersionLeaf
                      key={version.id}
                      number={version.versionNumber}
                      name={version.name}
                      date={version.updatedAt || version.createdAt}
                      onSelect={() => {
                        if (onSelectSheetVersion) {
                          onSelectSheetVersion(version);
                        }
                        if (window.innerWidth < 768) onClose();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const countMentionedChapters = (groupSheets: SheetResponse[]) => {
    const ids = new Set<number>();
    for (const sheet of groupSheets) {
      for (const entry of chaptersBySheetId.get(sheet.id) ?? []) ids.add(entry.chapter.id);
    }
    return ids.size;
  };

  const renderMentionedChapters = (groupSheets: SheetResponse[]) => (
    <div className={TREE_BRANCH}>
      {groupSheets.every((sheet) => !(chaptersBySheetId.get(sheet.id)?.length)) ? (
        <div className={TREE_EMPTY}>Aucun chapitre ne mentionne ces fiches</div>
      ) : (
        groupSheets.map((sheet) => {
          const entries = chaptersBySheetId.get(sheet.id) ?? [];
          if (entries.length === 0) return null;
          const key = `sheet-chapters-group-${sheet.id}`;
          const expanded = !!expandedFolders[key];
          return (
            <div key={key} className="flex flex-col">
              <button
                type="button"
                onClick={(event) => toggleFolder(key, event)}
                aria-expanded={expanded}
                className={row('l3')}
              >
                <IconChevronRight className={`size-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                <IconSheet className="size-3 shrink-0 opacity-60" />
                <span className="truncate">{sheet.name}</span>
                <span className={TREE_COUNT}>{entries.length}</span>
              </button>
              {expanded && (
                <div className={TREE_BRANCH}>
                  {entries.map(({ chapter, bookId }) => (
                    <button
                      type="button"
                      key={chapter.id}
                      onClick={() => {
                        navigate(`/books/${bookId}/chapters/${chapter.id}`);
                        closeAfterNavigation();
                      }}
                      className={row('leaf')}
                    >
                      <IconFile className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium leading-tight">
                          Chap. {chapter.chapter_number} · {chapter.title}
                        </div>
                        <div className="truncate text-[9px] font-sans tracking-wide opacity-60">
                          {books.find((book) => book.id === bookId)?.title ?? `Roman #${bookId}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const renderIdeaVersions = (groupIdeas: IdeaResponse[]) => (
    <div className={TREE_BRANCH}>
      {groupIdeas.length === 0 || groupIdeas.every((idea) => !(versionsByIdeaId.get(idea.id)?.length)) ? (
        <div className={TREE_EMPTY}>Aucune version d’idée</div>
      ) : (
        groupIdeas.map((idea) => {
          const versions = versionsByIdeaId.get(idea.id) ?? [];
          if (versions.length === 0) return null;
          const key = `idea-version-group-${idea.id}`;
          const expanded = !!expandedFolders[key];
          return (
            <div key={key} className="flex flex-col">
              <button
                type="button"
                onClick={(event) => toggleFolder(key, event)}
                aria-expanded={expanded}
                className={row('l3')}
              >
                <IconChevronRight className={`size-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                <IconIdea className="size-3 shrink-0 text-amber-400/70" />
                <span className="truncate">{idea.name}</span>
                <span className={TREE_COUNT}>{versions.length}</span>
              </button>
              {expanded && (
                <div className={TREE_BRANCH}>
                  {versions.map((version) => (
                    <VersionLeaf
                      key={version.id}
                      number={version.versionNumber}
                      name={version.name}
                      date={version.updatedAt || version.createdAt}
                      onSelect={() => {
                        if (onSelectIdeaVersion) {
                          onSelectIdeaVersion(version);
                        }
                        if (window.innerWidth < 768) onClose();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const renderCategoryGroup = (
    bookId: number | null,
    categoryId: number,
    groupSheets: SheetResponse[],
    groupIdeas: IdeaResponse[],
  ) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return null;

    const categoryKey = `book-${bookId ?? 'none'}-cat-${categoryId}`;
    const expanded = !!expandedFolders[categoryKey];
    const sheetsKey = `${categoryKey}-sheets`;
    const ideasKey = `${categoryKey}-ideas`;
    const sheetVersionsKey = `${categoryKey}-sheet-versions`;
    const ideaVersionsKey = `${categoryKey}-idea-versions`;
    const chaptersKey = `${categoryKey}-chapters`;

    const isCreatingSheetHere = creatingSheetInFolderKey === sheetsKey;
    const isCreatingIdeaHere = creatingIdeaInFolderKey === ideasKey;

    const subfolders = [
      {
        key: sheetsKey,
        label: 'Fiches',
        count: groupSheets.length,
        icon: IconSheet,
        content: (
          <div className={TREE_BRANCH}>
            {isCreatingSheetHere && (
              <div className="px-2 py-1">
                <input
                  ref={sheetInputRef}
                  type="text"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateSheetSubmit(categoryId, bookId);
                    if (e.key === 'Escape') setCreatingSheetInFolderKey(null);
                  }}
                  onBlur={() => void handleCreateSheetSubmit(categoryId, bookId)}
                  placeholder="Nom de la fiche..."
                  className={INPUT}
                />
              </div>
            )}
            {groupSheets.length === 0 && !isCreatingSheetHere ? (
              <div className={TREE_EMPTY}>Aucune fiche</div>
            ) : (
              groupSheets.map((sheet, idx) => {
                const isCurrent = sheet.id === currentSheetId;
                return (
                  <div
                    key={sheet.id}
                    className={rowShell('leaf', isCurrent)}
                  >
                    <button
                      type="button"
                      onClick={() => navigateToSheet(sheet.id)}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={rowMain('leaf')}
                    >
                      <IconSheet className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      <span className="truncate">{sheet.name}</span>
                    </button>

                    <div className="hidden shrink-0 items-center group-hover/row:flex [@media(hover:none)]:flex">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); void handleMoveSheet(groupSheets, idx, -1); }}
                        className={ROW_ACTION}
                        title="Monter"
                      >
                        <IconUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === groupSheets.length - 1}
                        onClick={(e) => { e.stopPropagation(); void handleMoveSheet(groupSheets, idx, 1); }}
                        className={ROW_ACTION}
                        title="Descendre"
                      >
                        <IconDown className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ),
      },
      {
        key: ideasKey,
        label: 'Idées sans fiche',
        count: groupIdeas.length,
        icon: IconIdea,
        content: (
          <div className={TREE_BRANCH}>
            {isCreatingIdeaHere && (
              <div className="px-2 py-1">
                <input
                  ref={ideaInputRef}
                  type="text"
                  value={newIdeaName}
                  onChange={(e) => setNewIdeaName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateIdeaSubmit(categoryId, bookId);
                    if (e.key === 'Escape') setCreatingIdeaInFolderKey(null);
                  }}
                  onBlur={() => void handleCreateIdeaSubmit(categoryId, bookId)}
                  placeholder="Nom de l'idée..."
                  className={INPUT}
                />
              </div>
            )}
            {groupIdeas.length === 0 && !isCreatingIdeaHere ? (
              <div className={TREE_EMPTY}>Aucune idée libre</div>
            ) : (
              groupIdeas.map((idea) => (
                <button
                  type="button"
                  key={idea.id}
                  onClick={navigateToIdea}
                  className={row('leaf')}
                >
                  <IconIdea className="size-3.5 shrink-0 text-amber-400/70" aria-hidden="true" />
                  <span className="truncate">{idea.name}</span>
                </button>
              ))
            )}
          </div>
        ),
      },
      { key: chaptersKey, label: 'Chapitres mentionnant les fiches', count: countMentionedChapters(groupSheets), icon: IconFile, content: renderMentionedChapters(groupSheets) },
      { key: sheetVersionsKey, label: 'Versions des fiches', count: groupSheets.reduce((sum, sheet) => sum + (versionsBySheetId.get(sheet.id)?.length ?? 0), 0), icon: IconHistory, content: renderSheetVersions(groupSheets) },
      { key: ideaVersionsKey, label: 'Versions des idées', count: groupIdeas.reduce((sum, idea) => sum + (versionsByIdeaId.get(idea.id)?.length ?? 0), 0), icon: IconHistory, content: renderIdeaVersions(groupIdeas) },
    ];

    return (
      <div key={categoryKey} className="my-0.5 flex flex-col">
        <div className="flex items-center justify-between group">
          <button
            type="button"
            onClick={(event) => toggleFolder(categoryKey, event)}
            aria-expanded={expanded}
            className={row('l2')}
          >
            <IconChevronRight className={`size-3.5 shrink-0 text-amber-400/50 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="truncate">{category.name}</span>
            <span className={TREE_COUNT}>{groupSheets.length + groupIdeas.length}</span>
          </button>
        </div>

        {expanded && (
          <div className={TREE_BRANCH}>
            {subfolders.map((folder) => {
              const FolderIcon = folder.icon;
              const folderExpanded = !!expandedFolders[folder.key];
              const isSheetFolder = folder.key === sheetsKey;
              const isIdeaFolder = folder.key === ideasKey;

              return (
                <div key={folder.key} className="flex flex-col">
                  <div className="flex items-center justify-between group/sub">
                    <button
                      type="button"
                      onClick={(event) => toggleFolder(folder.key, event)}
                      aria-expanded={folderExpanded}
                      className={row('l3')}
                    >
                      <IconChevronRight className={`size-3 shrink-0 text-amber-400/50 transition-transform ${folderExpanded ? 'rotate-90' : ''}`} />
                      <FolderIcon className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      <span className="truncate">{folder.label}</span>
                      <span className={TREE_COUNT}>{folder.count}</span>
                    </button>

                    {isSheetFolder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedFolders((prev) => ({ ...prev, [categoryKey]: true, [sheetsKey]: true }));
                          setCreatingSheetInFolderKey(sheetsKey);
                        }}
                        title="Créer une fiche dans cette catégorie"
                        className={ROW_ACTION}
                      >
                        <IconAdd className="size-3.5" />
                      </button>
                    )}

                    {isIdeaFolder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedFolders((prev) => ({ ...prev, [categoryKey]: true, [ideasKey]: true }));
                          setCreatingIdeaInFolderKey(ideasKey);
                        }}
                        title="Créer une idée libre"
                        className={ROW_ACTION}
                      >
                        <IconAdd className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {folderExpanded && folder.content}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const bookIds = new Set<number | null>();
  for (const book of books) bookIds.add(book.id);

  const bookCategories = new Map<number | null, Map<number, SheetResponse[]>>();
  for (const sheet of sheets) {
    const bookId = bookOfSheet(cardsBySheet.get(sheet.id) ?? []);
    bookIds.add(bookId);
    const byCategory = bookCategories.get(bookId) ?? new Map<number, SheetResponse[]>();
    const list = byCategory.get(sheet.categoryId) ?? [];
    list.push(sheet);
    byCategory.set(sheet.categoryId, list);
    bookCategories.set(bookId, byCategory);
  }

  const ideasByBook = new Map<number | null, IdeaResponse[]>();
  for (const idea of freeIdeas) {
    const bookId = (idea as IdeaExplorerMeta).bookId ?? null;
    bookIds.add(bookId);
    const list = ideasByBook.get(bookId) ?? [];
    list.push(idea);
    ideasByBook.set(bookId, list);
  }

  if (bookIds.size === 0) bookIds.add(null);

  const bookGroups = Array.from(bookIds).sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return (books.find((item) => item.id === a)?.title ?? '').localeCompare(
      books.find((item) => item.id === b)?.title ?? '',
    );
  }).map((bookId) => {
    const categoryMap = bookCategories.get(bookId) ?? new Map<number, SheetResponse[]>();
    const bookIdeas = ideasByBook.get(bookId) ?? [];
    const categoryIds = new Set<number>(categories.map((c) => c.id));

    const categoriesForBook = Array.from(categoryIds).sort((a, b) => {
      const nameA = categories.find((item) => item.id === a)?.name ?? '';
      const nameB = categories.find((item) => item.id === b)?.name ?? '';
      return nameA.localeCompare(nameB);
    }).map((categoryId) => {
      const groupSheets = categoryMap.get(categoryId) ?? [];
      const groupIdeas = bookIdeas.filter((idea) => {
        const ideaCategoryId = (idea as IdeaExplorerMeta).categoryId ?? null;
        return ideaCategoryId === categoryId;
      });
      return { categoryId, sheets: groupSheets, ideas: groupIdeas };
    });

    return { bookId, categories: categoriesForBook };
  });

  const content = (
    <>
        {!embedded && <ExplorerNav />}

        <ExplorerToolbar title="Fiches et idées">
          <ToolbarButton onClick={() => setIsCreatingBook(true)} title="Créer un roman rapidement" label="Créer un roman">
            <IconBooks className="size-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton onClick={() => setIsCreatingCategory(true)} title="Créer une catégorie rapidement" label="Créer une catégorie">
            <IconAdd className="size-4" aria-hidden="true" />
          </ToolbarButton>
          {!embedded && (
            <ToolbarButton onClick={onClose} title="Fermer l'explorateur (Échap)" label="Fermer l'explorateur">
              <IconClose className="size-4" aria-hidden="true" />
            </ToolbarButton>
          )}
        </ExplorerToolbar>

        {isCreatingBook && (
          <div className="border-b border-amber-900/30 px-3 py-2">
            <input
              ref={bookInputRef}
              type="text"
              value={newBookTitle}
              onChange={(e) => setNewBookTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateBookSubmit();
                if (e.key === 'Escape') setIsCreatingBook(false);
              }}
              onBlur={() => void handleCreateBookSubmit()}
              placeholder="Nom du nouveau roman..."
              className={INPUT}
            />
          </div>
        )}

        {isCreatingCategory && (
          <div className="border-b border-amber-900/30 px-3 py-2">
            <input
              ref={categoryInputRef}
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateCategorySubmit();
                if (e.key === 'Escape') setIsCreatingCategory(false);
              }}
              onBlur={() => void handleCreateCategorySubmit()}
              placeholder="Nom de la nouvelle catégorie..."
              className={INPUT}
            />
          </div>
        )}

        <div className={SCROLL}>
          {bookGroups.map(({ bookId, categories: categoryGroups }) => {
            const book = bookId == null ? undefined : books.find((item) => item.id === bookId);
            const bookName = bookId == null ? 'Non rattaché à un roman' : (book?.title ?? `Roman #${bookId}`);
            const bookKey = `book-${bookId ?? 'none'}`;
            const expanded = !!expandedFolders[bookKey];
            const totalSheets = categoryGroups.reduce((sum, group) => sum + group.sheets.length, 0);
            const totalIdeas = ideasByBook.get(bookId)?.length ?? 0;

            return (
              <div key={bookKey} className="flex flex-col">
                <button
                  type="button"
                  onClick={(event) => toggleFolder(bookKey, event)}
                  aria-expanded={expanded}
                  className={row('l1')}
                >
                  <IconChevronRight className={`size-4 shrink-0 text-amber-400/60 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  <IconBooks className="size-4 shrink-0 text-amber-500/90" aria-hidden="true" />
                  <span className="truncate">{bookName}</span>
                  <span className={TREE_COUNT}>{totalSheets + totalIdeas}</span>
                </button>

                {expanded && (
                  <div className={TREE_BRANCH}>
                    {categoryGroups.length === 0 ? (
                      <div className={TREE_EMPTY}>Aucune catégorie.</div>
                    ) : (
                      categoryGroups.map((group) => renderCategoryGroup(
                        bookId,
                        group.categoryId,
                        group.sheets,
                        group.ideas,
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ExplorerFooter>{books.length} {books.length > 1 ? 'romans' : 'roman'} · {sheets.length} {sheets.length > 1 ? 'fiches' : 'fiche'}</ExplorerFooter>
    </>
  );

  // Intégré à l'explorateur commun : seulement le contenu, l'enveloppe est fournie par lui.
  if (embedded) {
    return <div className={`flex min-h-0 flex-1 flex-col font-sans ${isOpen ? '' : 'hidden'}`}>{content}</div>;
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        ref={asideRef}
        aria-label="Explorateur des fiches et idées"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 left-0 z-[70] md:z-40 flex flex-col w-[min(88vw,21rem)] shrink-0 border-r border-amber-900/40 bg-[var(--c-surface)] shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none md:hidden'
        } md:sticky md:top-[var(--nav-top,0px)] md:bottom-auto md:left-auto md:h-[calc(100dvh-var(--nav-top,0px))] md:self-start md:w-80 md:translate-x-0 md:shadow-xl`}
      >
                {content}
      </aside>
    </>
  );
}

export default SheetExplorer;