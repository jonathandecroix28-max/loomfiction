import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../../categories/hooks/useCategories';
import { useSheets } from '../../sheets/hooks/useSheets';
import { offlineBookService } from '../../../services/offlineBookService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineSheetVersionService } from '../../../services/offlineSheetVersionService';
import { offlineIdeaVersionService } from '../../../services/offlineIdeaVersionService';
import type { BookResponse } from '../../../types/book';
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
  IconHistory,
  IconAdd,
  IconUp,
  IconDown,
} from '../../../components/icons';
import { formatDate } from '../../../utils/date/dateFormatter';
import { bookOfSheet } from '../sheetLinks';
import { useToast } from '../../../components/feedback/FeedbackProvider';
import { notifyDataChanged, useDataChanged } from '../../../hooks/useDataChanged';

type SheetExplorerProps = {
  isOpen: boolean;
  onClose: () => void;
  currentSheetId: number;
  onSelectSheetVersion?: (version: SheetVersionResponse) => void;
  onSelectIdeaVersion?: (version: IdeaVersionResponse) => void;
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
}: SheetExplorerProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, createCategory } = useCategories();
  const { sheets, refreshSheets } = useSheets();

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [ideas, setIdeas] = useState<IdeaResponse[]>([]);
  const [sheetVersions, setSheetVersions] = useState<SheetVersionResponse[]>([]);
  const [ideaVersions, setIdeaVersions] = useState<IdeaVersionResponse[]>([]);
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
      setBooks(booksData || []);
      setIdeas(ideasData || []);
      setSheetVersions(sheetVerData || []);
      setIdeaVersions(ideaVerData || []);
    } catch (err) {
      console.error('Erreur lors du chargement des données de l’explorateur :', err);
    }
  };

  // Mise à jour en direct quand la page (ou une modale) modifie des données ; on ignore nos propres événements.
  useDataChanged((source) => {
    if (source === 'sheet-explorer') return;
    void refreshSheets();
    void loadData();
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isCreatingBook, isCreatingCategory, creatingSheetInFolderKey, creatingIdeaInFolderKey]);

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
    navigate('/ideas');
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

  // Dossiers à ouvrir automatiquement pour la fiche courante.
  const autoExpandKeys = useMemo(() => {
    if (!isOpen || !currentSheetId || sheets.length === 0) return [];
    const currentSheet = sheets.find((sheet) => sheet.id === currentSheetId);
    if (!currentSheet) return [];

    const bookId = bookOfSheet(cardsBySheet.get(currentSheet.id) ?? []);
    const bookKey = `book-${bookId ?? 'none'}`;
    const categoryKey = `${bookKey}-cat-${currentSheet.categoryId}`;
    return [bookKey, categoryKey, `${categoryKey}-sheets`];
  }, [isOpen, currentSheetId, sheets, cardsBySheet]);

  // Ajustement d'état pendant le rendu (pas d'effet) quand les dossiers cibles changent.
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
    <div className="ml-4 my-1 flex flex-col space-y-1 border-l border-amber-900/20 pl-2">
      {groupSheets.length === 0 || groupSheets.every((sheet) => !(versionsBySheetId.get(sheet.id)?.length)) ? (
        <div className="py-1 text-[10px] text-amber-200/30 italic">Aucune version de fiche</div>
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
                className="flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] text-amber-200/60 hover:bg-amber-900/20 cursor-pointer"
              >
                <IconChevronRight className={`size-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                <IconSheet className="size-3 shrink-0 opacity-60" />
                <span className="truncate">{sheet.name}</span>
                <span className="ml-auto text-[10px] opacity-40">({versions.length})</span>
              </button>
              {expanded && (
                <div className="ml-4 flex flex-col border-l border-amber-900/20 pl-2">
                  {versions.map((version) => (
                    <button
                      type="button"
                      key={version.id}
                      onClick={() => {
                        if (onSelectSheetVersion) {
                          onSelectSheetVersion(version);
                        }
                        if (window.innerWidth < 768) onClose();
                      }}
                      className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-amber-200/50 hover:bg-amber-900/20 hover:text-amber-200 cursor-pointer"
                    >
                      <IconHistory className="size-3.5 shrink-0 opacity-60" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium leading-tight">
                          v{version.versionNumber}{version.name ? ` - ${version.name}` : ''}
                        </div>
                        <div className="text-[9px] font-sans tracking-wide opacity-60">
                          {formatDate(version.updatedAt || version.createdAt)}
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
    <div className="ml-4 my-1 flex flex-col space-y-1 border-l border-amber-900/20 pl-2">
      {groupIdeas.length === 0 || groupIdeas.every((idea) => !(versionsByIdeaId.get(idea.id)?.length)) ? (
        <div className="py-1 text-[10px] text-amber-200/30 italic">Aucune version d’idée</div>
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
                className="flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] text-amber-200/60 hover:bg-amber-900/20 cursor-pointer"
              >
                <IconChevronRight className={`size-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                <IconIdea className="size-3 shrink-0 text-amber-400/70" />
                <span className="truncate">{idea.name}</span>
                <span className="ml-auto text-[10px] opacity-40">({versions.length})</span>
              </button>
              {expanded && (
                <div className="ml-4 flex flex-col border-l border-amber-900/20 pl-2">
                  {versions.map((version) => (
                    <button
                      type="button"
                      key={version.id}
                      onClick={() => {
                        if (onSelectIdeaVersion) {
                          onSelectIdeaVersion(version);
                        }
                        if (window.innerWidth < 768) onClose();
                      }}
                      className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-amber-200/50 hover:bg-amber-900/20 hover:text-amber-200 cursor-pointer"
                    >
                      <IconHistory className="size-3.5 shrink-0 opacity-60" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium leading-tight">
                          v{version.versionNumber}{version.name ? ` - ${version.name}` : ''}
                        </div>
                        <div className="text-[9px] font-sans tracking-wide opacity-60">
                          {formatDate(version.updatedAt || version.createdAt)}
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

    const isCreatingSheetHere = creatingSheetInFolderKey === sheetsKey;
    const isCreatingIdeaHere = creatingIdeaInFolderKey === ideasKey;

    const subfolders = [
      {
        key: sheetsKey,
        label: 'Fiches',
        count: groupSheets.length,
        icon: IconSheet,
        content: (
          <div className="ml-4 my-1 flex flex-col space-y-0.5 border-l border-amber-900/20 pl-2">
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
                  className="w-full rounded border border-amber-800 bg-neutral-900 px-2 py-1 text-xs text-amber-100 focus:outline-none font-serif"
                />
              </div>
            )}
            {groupSheets.length === 0 && !isCreatingSheetHere ? (
              <div className="py-1 text-[10px] text-amber-200/30 italic">Aucune fiche</div>
            ) : (
              groupSheets.map((sheet, idx) => {
                const isCurrent = sheet.id === currentSheetId;
                return (
                  <div
                    key={sheet.id}
                    className={`group/item flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors ${
                      isCurrent
                        ? 'bg-amber-900/40 text-amber-100 font-bold'
                        : 'text-amber-200/70 hover:bg-amber-900/20 hover:text-amber-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => navigateToSheet(sheet.id)}
                      aria-current={isCurrent ? 'page' : undefined}
                      className="flex items-center gap-2 text-left truncate flex-1 cursor-pointer min-w-0"
                    >
                      <IconSheet className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      <span className="truncate">{sheet.name}</span>
                    </button>

                    <div className="hidden group-hover/item:flex items-center gap-0.5 shrink-0 ml-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); void handleMoveSheet(groupSheets, idx, -1); }}
                        className="p-1 rounded text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/40 disabled:opacity-30 cursor-pointer"
                        title="Monter"
                      >
                        <IconUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === groupSheets.length - 1}
                        onClick={(e) => { e.stopPropagation(); void handleMoveSheet(groupSheets, idx, 1); }}
                        className="p-1 rounded text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/40 disabled:opacity-30 cursor-pointer"
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
          <div className="ml-4 my-1 flex flex-col space-y-0.5 border-l border-amber-900/20 pl-2">
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
                  className="w-full rounded border border-amber-800 bg-neutral-900 px-2 py-1 text-xs text-amber-100 focus:outline-none font-serif"
                />
              </div>
            )}
            {groupIdeas.length === 0 && !isCreatingIdeaHere ? (
              <div className="py-1 text-[10px] text-amber-200/30 italic">Aucune idée libre</div>
            ) : (
              groupIdeas.map((idea) => (
                <button
                  type="button"
                  key={idea.id}
                  onClick={navigateToIdea}
                  className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-amber-200/70 transition-colors hover:bg-amber-900/20 hover:text-amber-200 cursor-pointer"
                >
                  <IconIdea className="size-3.5 shrink-0 text-amber-400/70" aria-hidden="true" />
                  <span className="truncate">{idea.name}</span>
                </button>
              ))
            )}
          </div>
        ),
      },
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
            className="flex flex-1 min-h-9 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-amber-200/70 hover:bg-amber-900/20 cursor-pointer min-w-0"
          >
            <IconChevronRight className={`size-3.5 shrink-0 text-amber-400/50 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="truncate font-medium">{category.name}</span>
            <span className="ml-auto text-[10px] opacity-40">{groupSheets.length + groupIdeas.length}</span>
          </button>
        </div>

        {expanded && (
          <div className="ml-4 my-1 flex flex-col space-y-0.5 border-l border-amber-900/20 pl-2">
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
                      className="flex flex-1 min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] text-amber-200/60 hover:bg-amber-900/20 cursor-pointer min-w-0"
                    >
                      <IconChevronRight className={`size-3 shrink-0 text-amber-400/50 transition-transform ${folderExpanded ? 'rotate-90' : ''}`} />
                      <FolderIcon className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      <span className="truncate">{folder.label}</span>
                      <span className="ml-auto text-[10px] opacity-40">({folder.count})</span>
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
                        className="opacity-0 group-hover/sub:opacity-100 p-1 text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/40 rounded transition-opacity cursor-pointer mr-1"
                      >
                        <IconAdd className="size-3" />
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
                        className="opacity-0 group-hover/sub:opacity-100 p-1 text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/40 rounded transition-opacity cursor-pointer mr-1"
                      >
                        <IconAdd className="size-3" />
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

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        aria-label="Explorateur des fiches et idées"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 left-0 z-40 flex h-[100dvh] flex-col w-[min(88vw,21rem)] shrink-0 border-r border-amber-900/40 bg-[var(--c-surface)] shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none md:hidden'
        } md:static md:h-[100dvh] md:w-80 md:translate-x-0 md:shadow-xl`}
      >
        <div className="flex flex-col shrink-0 border-b border-amber-900/40 bg-[var(--c-surface-2,#150e0c)]">
          <div className="flex items-center justify-between p-3">
            <span className="text-[10px] uppercase tracking-widest text-amber-200/50 font-semibold select-none">
              Explorateur du Grimoire
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsCreatingBook(true)}
                title="Créer un roman rapidement"
                aria-label="Créer un roman"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/35 transition-colors cursor-pointer"
              >
                <IconBooks className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingCategory(true)}
                title="Créer une catégorie rapidement"
                aria-label="Créer une catégorie"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/35 transition-colors cursor-pointer"
              >
                <IconAdd className="size-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Fermer l'explorateur (Échap)"
                aria-label="Fermer l'explorateur"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/35 transition-colors cursor-pointer"
              >
                <IconClose className="size-4" />
              </button>
            </div>
          </div>

          {isCreatingBook && (
            <div className="px-3 pb-3">
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
                className="w-full rounded-lg border border-amber-800 bg-neutral-900 px-3 py-1.5 text-xs text-amber-100 focus:outline-none font-serif"
              />
            </div>
          )}

          {isCreatingCategory && (
            <div className="px-3 pb-3">
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
                className="w-full rounded-lg border border-amber-800 bg-neutral-900 px-3 py-1.5 text-xs text-amber-100 focus:outline-none font-serif"
              />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 px-2 space-y-1 custom-scrollbar font-serif">
          <div className="pb-1 px-3 text-[10px] uppercase tracking-wider text-amber-200/40 font-semibold font-sans">
            Arborescence
          </div>

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
                  className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm text-amber-200/80 transition-colors hover:bg-amber-900/20 cursor-pointer"
                >
                  <IconChevronRight className={`size-4 shrink-0 text-amber-400/60 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  <IconBooks className="size-4 shrink-0 opacity-60" aria-hidden="true" />
                  <span className="truncate font-bold">{bookName}</span>
                  <span className="ml-auto text-[10px] opacity-40">{totalSheets + totalIdeas}</span>
                </button>

                {expanded && (
                  <div className="ml-3 my-1 flex flex-col space-y-1 border-l border-amber-900/20 pl-3">
                    {categoryGroups.length === 0 ? (
                      <div className="py-1 text-[10px] text-amber-200/30 italic">Aucune catégorie.</div>
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

        <div className="shrink-0 border-t border-amber-900/20 bg-[var(--c-surface-2,#150e0c)] px-3 py-2.5 text-center text-[10px] uppercase tracking-widest text-amber-200/30 font-sans">
          {books.length} {books.length > 1 ? 'romans' : 'roman'} · {sheets.length} {sheets.length > 1 ? 'fiches' : 'fiche'}
        </div>
      </aside>
    </>
  );
}

export default SheetExplorer;