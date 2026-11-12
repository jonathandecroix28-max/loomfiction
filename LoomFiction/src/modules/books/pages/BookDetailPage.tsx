import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBook } from '../hooks/useBook';
import { useChapters } from '../../chapters/hooks/useChapter';
import { useDeleteChapter } from '../../chapters/hooks/useDeleteChapter';
import { ChapterModal } from '../../chapters/components/ChapterModal';
import { formatDate } from '../../../utils/date/dateFormatter';
import { BookEditModal } from '../components/BookEditModal';
import { useConfirm, useToast } from '../../../components/feedback/FeedbackProvider';
import { offlineChapterVersionService } from '../../../services/offlineChapterVersionService';
import type { ChapterVersionResponse } from '../../../types/chapterVersion';
import type { ChapterResponse } from '../../../types/chapter';
import { htmlToPlainText } from '../../../utils/versions/sanitizeHtml';
import {
  IconAdd,
  IconBack,
  IconBook,
  IconBooks,
  IconChevronRight,
  IconCompare,
  IconDelete,
} from '../../../components/icons';
import { ChapterFolderCompareModal } from '../components/ChapterFolderCompareModal';
import type { SelectableVersionItem } from '../utils/bookDetailTypes';

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookId = id ? Number(id) : null;

  const { book, refreshBook, isLoading: isBookLoading, error } = useBook(bookId!);
  const { chapters, isLoadingChapters, setChapters } = useChapters(bookId);
  const { deleteChapter } = useDeleteChapter();
  const confirm = useConfirm();
  const toast = useToast();

  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [allVersions, setAllVersions] = useState<ChapterVersionResponse[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});

  const [compareSelection, setCompareSelection] = useState<{
    chapter: ChapterResponse | null;
    items: SelectableVersionItem[];
  }>({ chapter: null, items: [] });

  const [isCompareDrawerOpen, setIsCompareDrawerOpen] = useState(false);

  const loading = isBookLoading || isLoadingChapters;

  const loadVersions = useCallback(async () => {
    try {
      const data = await offlineChapterVersionService.getAll();
      setAllVersions(data ?? []);
    } catch (err) {
      console.error('Erreur lors du chargement des versions de chapitres :', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchVersions = async () => {
      try {
        const data = await offlineChapterVersionService.getAll();
        if (!cancelled) {
          setAllVersions(data ?? []);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des versions de chapitres :', err);
      }
    };

    void fetchVersions();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const versionsByChapterId = useMemo(() => {
    const map = new Map<number, ChapterVersionResponse[]>();
    for (const v of allVersions) {
      const list = map.get(v.chapterId) ?? [];
      list.push(v);
      map.set(v.chapterId, list);
    }
    map.forEach((list) => list.sort((a, b) => b.versionNumber - a.versionNumber));
    return map;
  }, [allVersions]);

  const toggleFolder = (chapterId: number) => {
    setExpandedFolders((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const toggleSelectItem = (
    chapter: ChapterResponse,
    item: SelectableVersionItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    setCompareSelection((prev) => {
      if (prev.chapter?.id !== chapter.id) {
        return { chapter, items: [item] };
      }

      const exists = prev.items.some((i) => i.id === item.id);
      if (exists) {
        const nextItems = prev.items.filter((i) => i.id !== item.id);
        return {
          chapter: nextItems.length > 0 ? chapter : null,
          items: nextItems,
        };
      }

      if (prev.items.length >= 2) {
        return {
          chapter,
          items: [prev.items[1], item],
        };
      }

      return {
        chapter,
        items: [...prev.items, item],
      };
    });
  };

  const handleDeleteVersion = async (version: ChapterVersionResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: `Supprimer la version v${version.versionNumber} ?`,
      message: 'Cette action est irréversible.',
      tone: 'danger',
    });
    if (!ok) return;

    const success = await offlineChapterVersionService.remove(version.id);
    if (success) {
      setAllVersions((prev) => prev.filter((v) => v.id !== version.id));
      setCompareSelection((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== version.id),
      }));
      toast.success(`Version v${version.versionNumber} supprimée.`);
    } else {
      toast.error('Impossible de supprimer cette version.');
    }
  };

  const handleDeleteChapter = async (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const chapterTitle = chapters.find((c) => c.id === chapterId)?.title;
    const ok = await confirm({
      title: chapterTitle ? `Supprimer « ${chapterTitle} » ?` : 'Supprimer ce chapitre ?',
      message: 'Cette action est irréversible.',
      tone: 'danger',
    });
    if (!ok) return;

    const success = await deleteChapter(chapterId);
    if (success) {
      setChapters(chapters.filter((c) => c.id !== chapterId));
      if (compareSelection.chapter?.id === chapterId) {
        setCompareSelection({ chapter: null, items: [] });
      }
      toast.success('Chapitre supprimé');
    } else {
      toast.error('Impossible de supprimer le chapitre.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#1c1411]">
        <p className="text-lg text-amber-200/60 font-serif italic animate-pulse">Ouverture du grimoire...</p>
      </div>
    );
  }

  if (error || !book) return null;

  const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const firstChapter = sortedChapters.length > 0 ? sortedChapters[0] : null;
  const legacyBook = book as unknown as { created_at?: string; cover_image?: string };
  const bookCreatedAt = legacyBook.created_at || book.createdAt;
  const bookCoverImage = legacyBook.cover_image || book.coverImage;

  return (
    <div className="min-h-screen bg-[#1c1411] text-[#fcf9f2] px-4 sm:px-6 py-8 md:px-16 font-sans overflow-x-hidden pb-28">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/books')}
          className="text-amber-200/60 hover:text-amber-100 font-serif text-sm mb-8 flex items-center gap-1.5 transition-colors cursor-pointer group"
        >
          <IconBack className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
          Retour à la bibliothèque
        </button>

        <div className="bg-neutral-950/70 border border-amber-900/30 rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl mb-10 md:mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/5 rounded-bl-full pointer-events-none" />

          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
            {bookCoverImage && (
              <div className="w-full md:w-40 h-56 rounded-2xl overflow-hidden shadow-lg border border-amber-900/30 shrink-0 bg-neutral-900">
                <img
                  src={bookCoverImage}
                  alt={`Couverture de ${book.title}`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="grow">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-amber-950 text-amber-300 font-sans font-semibold px-3 py-1 rounded-full text-xs tracking-wide uppercase border border-amber-800/40">
                  {chapters.length} {chapters.length > 1 ? 'chapitres' : 'chapitre'}
                </span>
                <span className="text-xs text-amber-200/40 font-serif italic">
                  Créé le {formatDate(bookCreatedAt)}
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-serif font-bold text-amber-100 tracking-tight mb-4">
                {book.title}
              </h1>

              <p className="text-amber-200/80 text-lg leading-relaxed font-serif italic">
                {book.description || 'Aucune description fournie pour ce roman.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-6 mt-8 border-t border-amber-900/30">
            {firstChapter && (
              <button
                onClick={() => navigate(`/books/${bookId}/chapters/${firstChapter.id}/read`)}
                className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-sans font-medium px-5 py-2.5 rounded-xl shadow-md transition text-sm cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto touch-target"
              >
                <IconBook className="size-4 shrink-0" aria-hidden="true" />
                Commencer la lecture
              </button>
            )}

            <button
              onClick={() => setIsChapterModalOpen(true)}
              className="bg-neutral-900 hover:bg-neutral-800 text-amber-200 font-sans font-medium px-5 py-2.5 rounded-xl border border-amber-900/30 transition text-sm cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto touch-target"
            >
              <IconAdd className="size-4 shrink-0" aria-hidden="true" />
              Ajouter un chapitre
            </button>

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-transparent hover:bg-neutral-900 text-amber-200/70 hover:text-amber-100 font-sans font-medium px-4 py-2.5 rounded-xl transition text-sm cursor-pointer sm:ml-auto w-full sm:w-auto touch-target"
            >
              Paramètres du roman
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-serif font-bold text-amber-100 flex items-center gap-2">
              <IconBooks className="size-5 shrink-0" aria-hidden="true" />
              Table des matières & Dossiers de versions
            </h2>
            <p className="text-xs text-amber-200/50 mt-1">
              Ouvrez un chapitre pour explorer ses versions, les comparer ligne par ligne ou les fusionner.
            </p>
          </div>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-16 bg-neutral-950/50 rounded-2xl border border-dashed border-amber-900/30 px-6">
            <p className="text-amber-200/60 font-serif text-lg mb-2">Ce livre est encore une page blanche.</p>
            <p className="text-xs text-amber-200/40 font-sans mb-6">Commencez par rédiger votre tout premier chapitre.</p>
            <button
              onClick={() => setIsChapterModalOpen(true)}
              className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-sans font-medium px-5 py-2.5 rounded-xl shadow-md transition text-sm cursor-pointer inline-flex items-center gap-2"
            >
              <IconAdd className="size-4 shrink-0" aria-hidden="true" />
              Rédiger le chapitre 1
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedChapters.map((chapter, index) => {
              const isOpen = !!expandedFolders[chapter.id];
              const chapterVersions = versionsByChapterId.get(chapter.id) ?? [];

              const currentItem: SelectableVersionItem = {
                kind: 'current',
                id: 'current',
                label: 'Manuscrit actuel',
                name: chapter.title,
                content: chapter.content ?? '',
                updatedAt: chapter.updated_at || chapter.created_at,
                createdAt: chapter.created_at,
              };

              const isCurrentSelected =
                compareSelection.chapter?.id === chapter.id &&
                compareSelection.items.some((i) => i.id === 'current');

              return (
                <div
                  key={chapter.id}
                  className={`bg-neutral-950/70 border transition-all rounded-2xl overflow-hidden ${
                    isOpen
                      ? 'border-amber-600/50 shadow-lg'
                      : 'border-amber-900/20 hover:border-amber-700/40 shadow-md'
                  }`}
                >
                  <div
                    onClick={() => toggleFolder(chapter.id)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer group select-none"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <IconChevronRight
                        className={`size-4 shrink-0 text-amber-400/80 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        aria-hidden="true"
                      />

                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center font-serif font-bold text-base transition-colors shrink-0 ${
                          isOpen
                            ? 'bg-amber-700 text-amber-50 border-amber-500'
                            : 'bg-amber-950 group-hover:bg-amber-800 text-amber-300 border-amber-800/40'
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif font-bold text-amber-100 text-lg group-hover:text-amber-300 transition-colors truncate">
                            {chapter.title}
                          </h3>
                          <span className="text-[11px] bg-amber-950/90 text-amber-300/90 border border-amber-800/40 px-2.5 py-0.5 rounded-full">
                            {chapterVersions.length}{' '}
                            {chapterVersions.length > 1 ? 'versions archivées' : 'version archivée'}
                          </span>
                        </div>
                        <p className="text-xs text-amber-200/40 font-serif italic mt-0.5">
                          Dernière modification le {formatDate(chapter.updated_at || chapter.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/books/${bookId}/chapters/${chapter.id}/read`);
                        }}
                        className="text-xs bg-amber-950/80 hover:bg-amber-900 text-amber-200 px-3.5 py-2 rounded-lg transition font-sans font-medium cursor-pointer"
                      >
                        Lire
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/books/${bookId}/chapters/${chapter.id}`);
                        }}
                        className="text-xs bg-neutral-900 hover:bg-neutral-800 text-amber-200 border border-amber-900/30 px-3.5 py-2 rounded-lg transition font-sans font-medium cursor-pointer"
                      >
                        Éditer
                      </button>

                      <button
                        onClick={(e) => handleDeleteChapter(chapter.id, e)}
                        className="text-xs bg-red-950/50 hover:bg-red-900/80 text-red-300 border border-red-900/30 px-3 py-2 rounded-lg transition font-sans font-medium cursor-pointer"
                        title="Supprimer le chapitre"
                        aria-label="Supprimer le chapitre"
                      >
                        <IconDelete className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="bg-black/40 border-t border-amber-900/20 px-4 sm:px-6 py-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-widest text-amber-200/50 font-semibold">
                          Cochez 2 éléments pour les comparer ou les fusionner
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/books/${bookId}/chapters/${chapter.id}/versions`);
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer"
                        >
                          Ouvrir la vue pleine page des versions →
                        </button>
                      </div>

                      <div className="space-y-2 border-l-2 border-amber-800/40 pl-3 sm:pl-4 ml-1.5">
                        <div
                          onClick={(e) => toggleSelectItem(chapter, currentItem, e)}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            isCurrentSelected
                              ? 'bg-amber-900/30 border-amber-500/70'
                              : 'bg-neutral-900/80 border-emerald-900/30 hover:border-amber-700/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isCurrentSelected}
                              onChange={() => {}}
                              className="accent-amber-500 w-4 h-4 rounded cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-amber-100 truncate">
                                  Manuscrit actuel ({chapter.title})
                                </span>
                                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded-full shrink-0">
                                  En cours
                                </span>
                              </div>
                              <p className="text-xs text-amber-200/45 font-serif italic">
                                Modifié le {formatDate(currentItem.updatedAt)} ·{' '}
                                {htmlToPlainText(currentItem.content).split(/\s+/).filter(Boolean).length} mots
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/books/${bookId}/chapters/${chapter.id}`);
                            }}
                            className="text-xs bg-neutral-950 hover:bg-neutral-800 text-amber-200 px-3 py-1.5 rounded-lg border border-amber-900/30 self-end sm:self-center cursor-pointer"
                          >
                            Éditeur
                          </button>
                        </div>

                        {chapterVersions.length === 0 ? (
                          <p className="text-xs text-amber-200/40 italic py-2 pl-2">
                            Aucune version archivée pour ce chapitre. Créez-en une depuis l’éditeur pour suivre vos révisions.
                          </p>
                        ) : (
                          chapterVersions.map((version) => {
                            const archiveItem: SelectableVersionItem = {
                              kind: 'archive',
                              id: version.id,
                              label: `v${version.versionNumber}${version.name ? ` · ${version.name}` : ''}`,
                              raw: version,
                            };

                            const isSelected =
                              compareSelection.chapter?.id === chapter.id &&
                              compareSelection.items.some((i) => i.id === version.id);

                            return (
                              <div
                                key={version.id}
                                onClick={(e) => toggleSelectItem(chapter, archiveItem, e)}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-900/30 border-amber-500/70'
                                    : 'bg-neutral-900/50 border-amber-900/20 hover:border-amber-700/40'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="accent-amber-500 w-4 h-4 rounded cursor-pointer shrink-0"
                                  />
                                  <span className="inline-flex h-7 min-w-7 px-1.5 items-center justify-center rounded-full border border-amber-800/40 bg-amber-950 text-amber-300 text-xs font-bold shrink-0">
                                    v{version.versionNumber}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-amber-100 truncate">
                                      {version.name || `Version ${version.versionNumber}`}
                                    </div>
                                    <p className="text-xs text-amber-200/45 font-serif italic">
                                      {formatDate(version.updatedAt)} ·{' '}
                                      {htmlToPlainText(version.content ?? '').split(/\s+/).filter(Boolean).length} mots
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCompareSelection({
                                        chapter,
                                        items: [currentItem, archiveItem],
                                      });
                                      setIsCompareDrawerOpen(true);
                                    }}
                                    className="text-xs bg-amber-950/90 hover:bg-amber-800 text-amber-200 border border-amber-800/40 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                                    title="Comparer immédiatement avec le manuscrit actuel"
                                  >
                                    Comparer à l’actuel
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/books/${bookId}/chapters/${chapter.id}/versions/${version.id}`);
                                    }}
                                    className="text-xs bg-neutral-950 hover:bg-neutral-800 text-amber-200/80 px-2.5 py-1.5 rounded-lg border border-amber-900/30 transition cursor-pointer"
                                  >
                                    Ouvrir
                                  </button>

                                  <button
                                    onClick={(e) => handleDeleteVersion(version, e)}
                                    className="text-xs bg-red-950/40 hover:bg-red-900/80 text-red-300 border border-red-900/30 p-1.5 rounded-lg transition cursor-pointer"
                                    title="Supprimer cette version"
                                  >
                                    <IconDelete className="size-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {compareSelection.items.length > 0 && compareSelection.chapter && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 backdrop-blur-md border border-amber-500/50 text-amber-100 px-5 py-3.5 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4 max-w-2xl w-[94%]">
          <div className="min-w-0">
            <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider truncate">
              Dossier : {compareSelection.chapter.title}
            </p>
            <p className="text-sm font-serif truncate">
              {compareSelection.items.length === 1 ? (
                `${compareSelection.items[0].label} — Sélectionnez une 2ᵉ version dans ce dossier`
              ) : (
                <>
                  {compareSelection.items[0].label}
                  <IconCompare className="mx-2 inline size-3.5 text-amber-500" aria-hidden="true" />
                  {compareSelection.items[1].label}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCompareSelection({ chapter: null, items: [] })}
              className="text-xs text-amber-200/60 hover:text-amber-100 px-3 py-2 cursor-pointer"
            >
              Annuler
            </button>
            <button
              disabled={compareSelection.items.length < 2}
              onClick={() => setIsCompareDrawerOpen(true)}
              className={`text-xs font-semibold px-4 py-2.5 rounded-xl transition ${
                compareSelection.items.length === 2
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              Comparer & Fusionner
            </button>
          </div>
        </div>
      )}

      {isCompareDrawerOpen &&
        compareSelection.chapter &&
        compareSelection.items.length === 2 && (
          <ChapterFolderCompareModal
            chapter={compareSelection.chapter}
            itemA={compareSelection.items[0]}
            itemB={compareSelection.items[1]}
            onClose={() => setIsCompareDrawerOpen(false)}
            onMerged={async (updatedChapters) => {
              setChapters(updatedChapters);
              await loadVersions();
              setIsCompareDrawerOpen(false);
              setCompareSelection({ chapter: null, items: [] });
            }}
          />
        )}

      <ChapterModal
        isOpen={isChapterModalOpen}
        onClose={() => setIsChapterModalOpen(false)}
        bookId={book.id}
        nextChapterNumber={chapters.length + 1}
        onChapterCreated={(newChapters) => setChapters(newChapters)}
      />

      <BookEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        book={book}
        onBookUpdated={() => refreshBook()}
      />
    </div>
  );
}