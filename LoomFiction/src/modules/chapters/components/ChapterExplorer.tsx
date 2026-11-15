import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChapters } from '../hooks/useChapter';
import { offlineChapterVersionService } from '../../../services/offlineChapterVersionService';
import { offlineChapterService } from '../../../services/offlineChapterService';
import { offlineBookService } from '../../../services/offlineBookService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import type { ChapterVersionResponse } from '../../../types/chapterVersion';
import type { BookResponse } from '../../../types/book';
import type { SheetResponse } from '../../../types/sheet';
import {
  IconChevronRight,
  IconAdd,
  IconClose,
  IconHistory,
  IconBooks,
  IconSheet,
} from '../../../components/icons';
import { formatDate } from '../../../utils/date/dateFormatter';
import { useToast } from '../../../components/feedback/FeedbackProvider';

type ChapterExplorerProps = {
  isOpen: boolean;
  onClose: () => void;
  bookId: number;
  currentChapterId: number;
  onNavigate: (chapterId: number) => void;
  onSelectVersion?: (version: ChapterVersionResponse) => void;
};

export function ChapterExplorer({
  isOpen,
  onClose,
  bookId,
  currentChapterId,
  onNavigate,
  onSelectVersion,
}: ChapterExplorerProps) {
  const navigate = useNavigate();
  const toast = useToast();

  const { chapters, isLoadingChapters, setChapters } = useChapters(bookId);

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [sheets, setSheets] = useState<SheetResponse[]>([]);
  const [allVersions, setAllVersions] = useState<ChapterVersionResponse[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const [chaptersByBook, setChaptersByBook] = useState<Record<number, any[]>>({});
  const [isLoadingAllChapters, setIsLoadingAllChapters] = useState(false);

  const [isCreatingBook, setIsCreatingBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const bookInputRef = useRef<HTMLInputElement>(null);

  const [isCreatingChapterForBookId, setIsCreatingChapterForBookId] = useState<number | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const chapterInputRef = useRef<HTMLInputElement>(null);

  const [creatingVersionForChapterId, setCreatingVersionForChapterId] = useState<number | null>(null);
  const [newVersionName, setNewVersionName] = useState('');
  const versionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingBook && bookInputRef.current) bookInputRef.current.focus();
  }, [isCreatingBook]);

  useEffect(() => {
    if (isCreatingChapterForBookId !== null && chapterInputRef.current) chapterInputRef.current.focus();
  }, [isCreatingChapterForBookId]);

  useEffect(() => {
    if (creatingVersionForChapterId !== null && versionInputRef.current) versionInputRef.current.focus();
  }, [creatingVersionForChapterId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isCreatingBook) {
          setIsCreatingBook(false);
          setNewBookTitle('');
        } else if (isCreatingChapterForBookId !== null) {
          setIsCreatingChapterForBookId(null);
          setNewChapterTitle('');
        } else if (creatingVersionForChapterId !== null) {
          setCreatingVersionForChapterId(null);
          setNewVersionName('');
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isCreatingBook, isCreatingChapterForBookId, creatingVersionForChapterId]);

  const loadGlobalData = async () => {
    try {
      setIsLoadingAllChapters(true);
      const [booksData, sheetsData, versionsData] = await Promise.all([
        offlineBookService.getAll().catch(() => []),
        offlineSheetService.getAll().catch(() => []),
        offlineChapterVersionService.getAll().catch(() => []),
      ]);
      setBooks(booksData ?? []);
      setSheets(sheetsData ?? []);
      setAllVersions(versionsData ?? []);

      const chapterMap: Record<number, any[]> = {};
      for (const b of (booksData ?? [])) {
        // Utilisation de getByBookId au lieu de getByBook
        const chs = await offlineChapterService.getByBookId(b.id).catch(() => []);
        chapterMap[b.id] = chs ?? [];
      }
      setChaptersByBook(chapterMap);
    } catch (err) {
      console.error('Erreur lors du chargement des données de l’explorateur :', err);
    } finally {
      setIsLoadingAllChapters(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetchAll = async () => {
      await loadGlobalData();
    };
    if (!cancelled) void fetchAll();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (chapters.length > 0) {
      setChaptersByBook((prev) => ({
        ...prev,
        [bookId]: chapters,
      }));
    }
  }, [chapters, bookId]);

  const versionsByChapterId = useMemo(() => {
    const map = new Map<number, ChapterVersionResponse[]>();
    for (const version of allVersions) {
      const list = map.get(version.chapterId) ?? [];
      list.push(version);
      map.set(version.chapterId, list);
    }
    map.forEach((list) => list.sort((a, b) => b.versionNumber - a.versionNumber));
    return map;
  }, [allVersions]);

  const getMentionedSheetsForChapter = (chapterContent: string): SheetResponse[] => {
    if (!chapterContent) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(chapterContent, 'text/html');
    const mentionNodes = doc.querySelectorAll('[data-type="mention"]');
    const sheetIds = new Set<number>();

    mentionNodes.forEach((node) => {
      const idAttr = node.getAttribute('data-id');
      if (idAttr) {
        const parsedId = Number(idAttr);
        if (!isNaN(parsedId)) sheetIds.add(parsedId);
      }
    });

    return sheets.filter((sheet) => sheetIds.has(sheet.id));
  };

  useEffect(() => {
    if (isOpen && bookId) {
      setExpandedFolders((prev) => ({
        ...prev,
        [`book-${bookId}`]: true,
        ...(currentChapterId ? { [`chapter-${currentChapterId}`]: true } : {}),
      }));
    }
  }, [isOpen, bookId, currentChapterId]);

  const toggleFolder = (key: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChapterNavigation = (targetBookId: number, targetChapterId: number) => {
    if (targetBookId !== bookId) {
      navigate(`/books/${targetBookId}/chapters/${targetChapterId}`);
    } else if (targetChapterId !== currentChapterId) {
      onNavigate(targetChapterId);
    }
    if (window.innerWidth < 768) onClose();
  };

  const handleCreateBookSubmit = async () => {
    const title = newBookTitle.trim();
    if (!title) {
      setIsCreatingBook(false);
      setNewBookTitle('');
      return;
    }
    try {
      const newBooks = await offlineBookService.create(title);
      await loadGlobalData();
      setIsCreatingBook(false);
      setNewBookTitle('');
      toast.success(`Roman "${title}" créé`);
      
      const createdBook = newBooks[newBooks.length - 1];
      if (createdBook && createdBook.id) {
        navigate(`/books/${createdBook.id}/chapters`);
      }
    } catch (err) {
      console.error('Erreur création roman :', err);
      toast.error('Impossible de créer le roman.');
    }
  };

  const handleCreateChapterSubmit = async (targetBookId: number) => {
    const trimmedTitle = newChapterTitle.trim();
    if (!trimmedTitle) {
      setIsCreatingChapterForBookId(null);
      setNewChapterTitle('');
      return;
    }

    try {
      const bookChapters = chaptersByBook[targetBookId] ?? [];
      const nextNumber =
        bookChapters.length > 0
          ? Math.max(...bookChapters.map((c: any) => c.chapter_number)) + 1
          : 1;

      const updatedChapters = await offlineChapterService.create(
        targetBookId,
        trimmedTitle,
        nextNumber,
        ''
      );

      if (updatedChapters) {
        setChaptersByBook((prev) => ({ ...prev, [targetBookId]: updatedChapters }));
        if (targetBookId === bookId) {
          setChapters(updatedChapters);
        }
        setIsCreatingChapterForBookId(null);
        setNewChapterTitle('');
        
        const createdChapter = updatedChapters.find(
          (c: any) => Number(c.chapter_number) === nextNumber
        );
        if (createdChapter) {
          handleChapterNavigation(targetBookId, createdChapter.id);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la création du chapitre :', error);
    }
  };

  const handleCreateVersionSubmit = async (chapterId: number) => {
    const trimmedName = newVersionName.trim();
    const chapterVersions = versionsByChapterId.get(chapterId) ?? [];
    
    const nextVersionNumber =
      chapterVersions.length > 0
        ? Math.max(...chapterVersions.map((v) => Number(v.versionNumber))) + 1
        : 1;

    let targetChapter: any = null;
    Object.values(chaptersByBook).forEach((chs) => {
      const found = chs.find((c: any) => c.id === chapterId);
      if (found) targetChapter = found;
    });

    try {
      await offlineChapterVersionService.create({
        chapterId: Number(chapterId),
        versionNumber: nextVersionNumber,
        name: trimmedName || `Version ${nextVersionNumber}`,
        content: targetChapter?.content || '',
      });

      const versionsData = await offlineChapterVersionService.getAll();
      setAllVersions(versionsData ?? []);
      setCreatingVersionForChapterId(null);
      setNewVersionName('');
      setExpandedFolders((prev) => ({ ...prev, [`chapter-${chapterId}`]: true, [`chapter-${chapterId}-versions`]: true }));
    } catch (error) {
      console.error('Erreur lors de la création de la version :', error);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/65 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        aria-label="Explorateur des romans et chapitres"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 left-0 z-40 flex h-[100dvh] flex-col w-[min(88vw,21rem)] shrink-0 border-r border-amber-900/40 bg-[var(--c-surface)] shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none md:hidden'
        } md:static md:h-[100dvh] md:w-80 md:translate-x-0 md:shadow-xl`}
      >
        <div className="flex shrink-0 items-center justify-between p-3 border-b border-amber-900/40 bg-[var(--c-surface-2)]">
          <span className="text-[10px] uppercase tracking-widest text-amber-200/50 font-semibold select-none">
            Explorateur des Romans
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsCreatingBook(true)}
              title="Créer un nouveau roman"
              aria-label="Créer un roman"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/30 transition-colors cursor-pointer"
            >
              <IconBooks className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fermer l'explorateur"
              aria-label="Fermer l'explorateur"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/30 transition-colors cursor-pointer"
            >
              <IconClose className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {isCreatingBook && (
          <div className="p-2.5 bg-neutral-950 border-b border-amber-900/30">
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
              placeholder="Titre du nouveau roman..."
              className="w-full rounded border border-amber-800 bg-neutral-900 px-2.5 py-1 text-xs text-amber-100 focus:outline-none font-serif"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 px-2 space-y-1 custom-scrollbar">
          {isLoadingChapters && books.length === 0 ? (
            <div className="px-4 py-3 text-xs text-amber-200/40 font-serif italic">
              Chargement...
            </div>
          ) : books.length === 0 ? (
            <div className="px-4 py-3 text-xs text-amber-200/40 font-serif italic">
              Aucun roman trouvé.
            </div>
          ) : (
            books.map((book) => {
              const isCurrentBook = book.id === bookId;
              const bookKey = `book-${book.id}`;
              const isBookExpanded = !!expandedFolders[bookKey];
              const bookChapters = [...(chaptersByBook[book.id] ?? [])].sort((a, b) => a.chapter_number - b.chapter_number);
              const isCreatingChapterHere = isCreatingChapterForBookId === book.id;

              return (
                <div key={book.id} className="flex flex-col">
                  <div
                    className={`group flex items-center justify-between gap-1 rounded-lg transition-colors ${
                      isCurrentBook ? 'bg-amber-950/50 text-amber-100 font-medium' : 'text-amber-200/70 hover:bg-amber-900/20'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => toggleFolder(bookKey, e)}
                      aria-expanded={isBookExpanded}
                      className="flex flex-1 items-center gap-1.5 px-2 py-2 text-left text-xs font-bold cursor-pointer min-w-0"
                    >
                      <IconChevronRight
                        className={`size-3.5 shrink-0 text-amber-400/60 transition-transform ${isBookExpanded ? 'rotate-90' : ''}`}
                        aria-hidden="true"
                      />
                      <IconBooks className="size-4 shrink-0 opacity-70" aria-hidden="true" />
                      <span className="truncate">{book.title}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedFolders((prev) => ({ ...prev, [bookKey]: true }));
                        setIsCreatingChapterForBookId(book.id);
                      }}
                      title="Ajouter un chapitre dans ce roman"
                      className="p-1.5 mr-1 text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/40 rounded transition-colors cursor-pointer"
                    >
                      <IconAdd className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  {isBookExpanded && (
                    <div className="ml-3 my-1 flex flex-col space-y-1 border-l border-amber-900/20 pl-3">
                      {isCreatingChapterHere && (
                        <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/50 my-1">
                          <span className="text-xs text-amber-200/50 pl-1 font-medium">
                            {bookChapters.length + 1}.
                          </span>
                          <input
                            ref={chapterInputRef}
                            type="text"
                            value={newChapterTitle}
                            onChange={(e) => setNewChapterTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleCreateChapterSubmit(book.id);
                              if (e.key === 'Escape') {
                                setIsCreatingChapterForBookId(null);
                                setNewChapterTitle('');
                              }
                            }}
                            onBlur={() => void handleCreateChapterSubmit(book.id)}
                            placeholder="Titre du chapitre..."
                            className="w-full bg-transparent text-xs text-amber-100 focus:outline-none placeholder:text-amber-200/30 font-serif"
                          />
                        </div>
                      )}

                      {isLoadingAllChapters && bookChapters.length === 0 ? (
                        <div className="py-2 text-[11px] text-amber-200/40 italic">Chargement des chapitres...</div>
                      ) : bookChapters.length === 0 && !isCreatingChapterHere ? (
                        <div className="py-2 text-[11px] text-amber-200/40 italic">Aucun chapitre dans ce roman.</div>
                      ) : (
                        bookChapters.map((chapter) => {
                          const isCurrentChapter = chapter.id === currentChapterId && isCurrentBook;
                          const chapterKey = `chapter-${chapter.id}`;
                          const isChapterExpanded = !!expandedFolders[chapterKey];
                          const chapterVersions = versionsByChapterId.get(chapter.id) ?? [];
                          const mentionedSheets = getMentionedSheetsForChapter(chapter.content);

                          const versionsKey = `${chapterKey}-versions`;
                          const sheetsKey = `${chapterKey}-sheets`;
                          const isVersionsExpanded = !!expandedFolders[versionsKey];
                          const isSheetsExpanded = !!expandedFolders[sheetsKey];
                          const isCreatingVersionHere = creatingVersionForChapterId === chapter.id;

                          return (
                            <div key={chapter.id} className="flex flex-col">
                              <div
                                className={`group flex items-center justify-between gap-1 rounded-lg transition-colors ${
                                  isCurrentChapter
                                    ? 'bg-amber-900/40 text-amber-100 font-medium'
                                    : 'text-amber-200/70 hover:bg-amber-900/20'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => toggleFolder(chapterKey, e)}
                                  aria-expanded={isChapterExpanded}
                                  className="flex flex-1 items-center gap-1.5 py-2 pl-1 pr-2 text-left text-xs cursor-pointer min-w-0"
                                >
                                  <IconChevronRight
                                    className={`size-3.5 shrink-0 text-amber-400/60 transition-transform ${isChapterExpanded ? 'rotate-90' : ''}`}
                                    aria-hidden="true"
                                  />
                                  <span className="opacity-50 shrink-0">{chapter.chapter_number}.</span>
                                  <span
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      handleChapterNavigation(book.id, chapter.id);
                                    }}
                                    className="truncate hover:underline"
                                  >
                                    {chapter.title}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedFolders((prev) => ({ ...prev, [chapterKey]: true, [versionsKey]: true }));
                                    setCreatingVersionForChapterId(chapter.id);
                                  }}
                                  title="Archiver une nouvelle version"
                                  className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-amber-200/60 hover:text-amber-100 hover:bg-amber-900/40 rounded transition-opacity cursor-pointer"
                                >
                                  <IconAdd className="size-3" aria-hidden="true" />
                                </button>
                              </div>

                              {isChapterExpanded && (
                                <div className="ml-3 my-1 flex flex-col space-y-1 border-l border-amber-900/20 pl-3">
                                  {/* Sous-dossier : Versions */}
                                  <div className="flex flex-col">
                                    <button
                                      type="button"
                                      onClick={(e) => toggleFolder(versionsKey, e)}
                                      aria-expanded={isVersionsExpanded}
                                      className="flex items-center gap-1.5 py-1 px-1.5 rounded text-[11px] text-amber-200/60 hover:bg-amber-900/20 cursor-pointer"
                                    >
                                      <IconChevronRight className={`size-3 transition-transform ${isVersionsExpanded ? 'rotate-90' : ''}`} />
                                      <IconHistory className="size-3 opacity-60" />
                                      <span>Versions ({chapterVersions.length})</span>
                                    </button>

                                    {isVersionsExpanded && (
                                      <div className="ml-4 my-1 flex flex-col space-y-1 border-l border-amber-900/20 pl-2">
                                        {isCreatingVersionHere && (
                                          <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-950/60 border border-amber-500/50 my-1">
                                            <span className="text-[10px] text-amber-200/50 font-medium">v</span>
                                            <input
                                              ref={versionInputRef}
                                              type="text"
                                              value={newVersionName}
                                              onChange={(e) => setNewVersionName(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') void handleCreateVersionSubmit(chapter.id);
                                                if (e.key === 'Escape') setCreatingVersionForChapterId(null);
                                              }}
                                              onBlur={() => void handleCreateVersionSubmit(chapter.id)}
                                              placeholder="Nom de la version..."
                                              className="w-full bg-transparent text-xs text-amber-100 focus:outline-none font-serif"
                                            />
                                          </div>
                                        )}
                                        {chapterVersions.length === 0 && !isCreatingVersionHere ? (
                                          <div className="py-1 text-[10px] text-amber-200/30 italic">Aucune version</div>
                                        ) : (
                                          chapterVersions.map((version) => (
                                            <button
                                              type="button"
                                              key={version.id}
                                              onClick={() => {
                                                handleChapterNavigation(book.id, chapter.id);
                                                if (onSelectVersion) onSelectVersion(version);
                                              }}
                                              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] text-amber-200/50 hover:bg-amber-900/20 hover:text-amber-200 cursor-pointer"
                                            >
                                              <IconHistory className="size-3 opacity-60 shrink-0" />
                                              <div className="min-w-0 flex-1">
                                                <div className="truncate font-medium">
                                                  v{version.versionNumber} {version.name ? `- ${version.name}` : ''}
                                                </div>
                                                <div className="text-[9px] font-sans opacity-60">
                                                  {formatDate(version.updatedAt || version.createdAt)}
                                                </div>
                                              </div>
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Sous-dossier : Fiches mentionnées */}
                                  <div className="flex flex-col">
                                    <button
                                      type="button"
                                      onClick={(e) => toggleFolder(sheetsKey, e)}
                                      aria-expanded={isSheetsExpanded}
                                      className="flex items-center gap-1.5 py-1 px-1.5 rounded text-[11px] text-amber-200/60 hover:bg-amber-900/20 cursor-pointer"
                                    >
                                      <IconChevronRight className={`size-3 transition-transform ${isSheetsExpanded ? 'rotate-90' : ''}`} />
                                      <IconSheet className="size-3 opacity-60" />
                                      <span>Fiches mentionnées ({mentionedSheets.length})</span>
                                    </button>

                                    {isSheetsExpanded && (
                                      <div className="ml-4 my-1 flex flex-col space-y-1 border-l border-amber-900/20 pl-2">
                                        {mentionedSheets.length === 0 ? (
                                          <div className="py-1 text-[10px] text-amber-200/30 italic">Aucune fiche liée</div>
                                        ) : (
                                          mentionedSheets.map((sheet) => (
                                            <button
                                              type="button"
                                              key={sheet.id}
                                              onClick={() => {
                                                navigate(`/ideas/fiches/${sheet.id}`);
                                                if (window.innerWidth < 768) onClose();
                                              }}
                                              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] text-amber-200/50 hover:bg-amber-900/20 hover:text-amber-200 cursor-pointer"
                                            >
                                              <IconSheet className="size-3 opacity-60 shrink-0" />
                                              <span className="truncate">{sheet.name}</span>
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 border-t border-amber-900/20 bg-[var(--c-surface-2)] px-3 py-2.5 text-center text-[10px] uppercase tracking-widest text-amber-200/30">
          {books.length} {books.length > 1 ? 'romans' : 'roman'}
        </div>
      </aside>
    </>
  );
}

export default ChapterExplorer;