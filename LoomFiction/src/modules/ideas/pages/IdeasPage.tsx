import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useIdeas } from '../hooks/useIdeas';
import { useDeleteIdea } from '../hooks/useDeleteIdea';
import { useCategories } from '../../categories/hooks/useCategories';
import { useSheets } from '../../sheets/hooks/useSheets';
import { offlineBookService } from '../../../services/offlineBookService';
import { bookOfSheet } from '../../sheets/sheetLinks';

import type { IdeaResponse, IdeaStatus } from '../../../types/idea';
import type { BookResponse } from '../../../types/book';
import type { CategoryResponse, CategoryUpsertRequest } from '../../../types/category';
import type { SheetResponse } from '../../../types/sheet';

import { IdeasHeader } from '../components/IdeasHeader';
import { IdeasFilters } from '../components/IdeasFilters';
import { IdeaModal } from '../components/IdeaModal';
import { IdeaCard } from '../components/IdeaCard';
import { ManageCategoriesModal } from '../../categories/components/ManageCategoriesModal';
import { CategoryQuickAdd } from '../../categories/components/CategoryQuickAdd';
import { SheetCard } from '../../sheets/components/SheetCard';
import { NewSheetModal } from '../../sheets/components/NewSheetModal';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export function IdeasPage() {
  const navigate = useNavigate();

  const { ideas, setIdeas, isLoading: areIdeasLoading, error: ideasError, refreshIdeas } = useIdeas(null);
  const { deleteIdea } = useDeleteIdea();
  const {
    categories, isLoading: areCategoriesLoading, createCategory, updateCategory, deleteCategory,
  } = useCategories();
  const { sheets, refreshSheets } = useSheets();

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<IdeaResponse | null>(null);
  const [newSheetCategory, setNewSheetCategory] = useState<CategoryResponse | null>(null);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const [ideaSearch, setIdeaSearch] = useState('');
  const [bookTitleFilter, setBookTitleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all');
  const [activeTab, setActiveTab] = useState<string>('all');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    offlineBookService
      .getAll()
      .then((data) => setBooks(data || []))
      .catch((err) => console.error('Erreur de chargement des romans :', err));
  }, []);

  const tabs = useMemo(
    () => [
      { id: 'all', label: 'Toutes les notes & fiches' },
      ...categories.map((cat) => ({ id: String(cat.id), label: cat.name })),
    ],
    [categories]
  );

  const goToTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      const index = tabs.findIndex((t) => t.id === tabId);
      const container = scrollContainerRef.current;
      if (container && index !== -1) {
        container.scrollTo({ left: container.offsetWidth * index, behavior: 'smooth' });
      }
    },
    [tabs]
  );

  useEffect(() => {
    if (pendingTab && tabs.some((t) => t.id === pendingTab)) {
      goToTab(pendingTab);
      setPendingTab(null);
    }
  }, [pendingTab, tabs, goToTab]);

  const sheetNameById = useMemo(() => new Map(sheets.map((s) => [s.id, s.name] as const)), [sheets]);

  const cardsBySheet = useMemo(() => {
    const map = new Map<number, IdeaResponse[]>();
    for (const idea of ideas) {
      if (idea.sheetId == null) continue;
      const list = map.get(idea.sheetId);
      if (list) list.push(idea);
      else map.set(idea.sheetId, [idea]);
    }
    return map;
  }, [ideas]);

  const ideasWithDetails = useMemo(
    () =>
      ideas.map((idea) => {
        const foundBook = books.find((b) => b.id === idea.bookId);
        return {
          ...idea,
          bookTitle: foundBook ? foundBook.title : 'Roman non rattaché',
          sheetName: idea.sheetId != null ? sheetNameById.get(idea.sheetId) : undefined,
        };
      }),
    [ideas, books, sheetNameById]
  );

  const search = ideaSearch.trim().toLowerCase();
  const matchesSearch = (idea: IdeaResponse) =>
    !search || idea.name.toLowerCase().includes(search) || (idea.description ?? '').toLowerCase().includes(search);

  const sheetMatches = (sheet: SheetResponse) => {
    const cards = cardsBySheet.get(sheet.id) ?? [];
    const sheetBookId = bookOfSheet(cards);
    const sheetBookTitle = sheetBookId == null ? 'sans roman' : books.find((book) => book.id === sheetBookId)?.title ?? 'roman non rattaché';
    
    const matchesQuery = !search || sheet.name.toLowerCase().includes(search) || cards.some(matchesSearch);
    const matchesBook = !bookTitleFilter.trim() || sheetBookTitle.toLowerCase().includes(bookTitleFilter.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || cards.some((card) => card.status === statusFilter);
    
    return matchesQuery && matchesBook && matchesStatus;
  };

  const handleCreateCategory = async (data: CategoryUpsertRequest) => {
    const known = new Set(categories.map((c) => c.id));
    const updated = await createCategory(data);
    const created = updated.find((c) => !known.has(c.id));
    if (created) setPendingTab(String(created.id));
    return updated;
  };

  const handleDeleteCategory = async (id: number) => {
    await deleteCategory(id);
    if (activeTab === String(id)) goToTab('all');
  };

  const handleDeleteIdea = async (ideaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer cette note ?')) return;

    const success = await deleteIdea(ideaId);
    if (success) setIdeas(ideas.filter((i) => i.id !== ideaId));
    else alert('Impossible de supprimer.');
  };

  if (areIdeasLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#1c1411]">
        <p className="text-lg text-amber-200/60 font-serif italic animate-pulse">Ouverture du grimoire...</p>
      </div>
    );
  }

  if (ideasError) return null;

  return (
    <div className="min-h-screen bg-[#1c1411] text-[#fcf9f2] flex flex-col font-sans overflow-x-hidden">
      
      {/* --- SECTION FIXE HAUT DE PAGE --- */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 md:px-12 shrink-0">
        
        <IdeasHeader 
          onManageCategories={() => setIsManageCategoriesOpen(true)}
          onNewIdea={() => { setSelectedIdea(null); setIsModalOpen(true); }}
        />

        {/* ONGLETS */}
        <div className="flex items-center gap-4 sm:gap-8 border-b border-amber-900/40 mb-6 overflow-x-auto text-sm font-serif scrollbar-none pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => goToTab(tab.id)}
              className={`pb-3 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === tab.id ? 'text-amber-400 border-b-2 border-amber-400 font-bold' : 'text-amber-200/60 hover:text-amber-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setIsAddingCategory((open) => !open)}
            aria-expanded={isAddingCategory}
            className="pb-3 shrink-0 cursor-pointer whitespace-nowrap text-amber-200/40 hover:text-amber-200 transition-colors"
          >
            + Catégorie
          </button>
        </div>

        {isAddingCategory && (
          <div className="mb-6 rounded-2xl border border-amber-900/30 bg-neutral-950/60 p-4">
            <CategoryQuickAdd
              existing={categories}
              onCreate={handleCreateCategory}
              onDone={() => setIsAddingCategory(false)}
              autoFocus
            />
          </div>
        )}

        <IdeasFilters 
          search={ideaSearch} onSearchChange={setIdeaSearch}
          bookFilter={bookTitleFilter} onBookFilterChange={setBookTitleFilter}
          statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        />

      </div>

      {/* --- ZONE DE SCROLL HORIZONTAL (ONGLETS) --- */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory scroll-smooth w-full no-scrollbar overscroll-x-contain"
        onScroll={(e) => {
          const target = e.currentTarget;
          const index = Math.round(target.scrollLeft / target.offsetWidth);
          if (tabs[index] && tabs[index].id !== activeTab) {
            setActiveTab(tabs[index].id);
          }
        }}
      >
        {tabs.map((tab) => {
          const isAll = tab.id === 'all';
          const category = isAll ? null : categories.find((c) => String(c.id) === tab.id) ?? null;

          const tabIdeas = ideasWithDetails.filter((idea) => {
            const matchesBookTitle = bookTitleFilter === '' || idea.bookTitle.toLowerCase().includes(bookTitleFilter.toLowerCase());
            const matchesStatus = statusFilter === 'all' || idea.status === statusFilter;
            const matchesTab = isAll ? idea.sheetId == null : (String(idea.categoryId) === tab.id && idea.sheetId == null);
            return matchesSearch(idea) && matchesBookTitle && matchesStatus && matchesTab;
          });

          const tabSheets = isAll
            ? sheets.filter(sheetMatches)
            : sheets.filter((sheet) => String(sheet.categoryId) === tab.id && sheetMatches(sheet));

          const summary = `${plural(tabSheets.length, 'fiche')} · ${plural(tabIdeas.length, 'note')}`;
          const showOnboarding = isAll && tabIdeas.length === 0 && tabSheets.length === 0 && !areCategoriesLoading && categories.length === 0;

          return (
            <div key={tab.id} className="w-full min-w-full shrink-0 snap-start px-4 sm:px-6 md:px-12 py-4 flex flex-col">
              <div className="w-full max-w-[1700px] mx-auto flex-1 space-y-8 pb-20">
                <div className="text-xs uppercase tracking-wider text-amber-200/40 font-serif font-semibold">
                  {tab.label} &bull; {summary}
                </div>

                {/* --- BLOC DES FICHES --- */}
                {(category || isAll) && (tabSheets.length > 0 || category) && (
                  <section>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="text-sm font-serif font-bold text-amber-200 flex items-center gap-2">
                        {category && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }} />}
                        {!category && <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                        Fiches {isAll && '(Toutes les catégories)'}
                      </h2>
                      {category && (
                        <button
                          onClick={() => setNewSheetCategory(category)}
                          className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium px-4 py-2 rounded-xl transition text-xs cursor-pointer shadow-md touch-target"
                        >
                          + Nouvelle fiche
                        </button>
                      )}
                    </div>

                    {tabSheets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-amber-900/30 px-6 py-8 text-center">
                        <p className="text-amber-200/60 font-serif">Aucune fiche pour le moment.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {tabSheets.map((sheet) => {
                          const cards = cardsBySheet.get(sheet.id) ?? [];
                          const sheetCategory = categories.find(c => c.id === sheet.categoryId);
                          return (
                            <SheetCard
                              key={sheet.id}
                              sheet={sheet}
                              color={sheetCategory?.color || '#d97706'}
                              total={cards.length}
                              filled={cards.filter((card) => card.description?.trim()).length}
                              bookTitle={(() => {
                                const bookId = bookOfSheet(cards);
                                return bookId == null ? 'Sans roman' : books.find((b) => b.id === bookId)?.title ?? 'Roman inconnu';
                              })()}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* --- BLOC DES NOTES LIBRES --- */}
                <section>
                  <h2 className="text-sm font-serif font-bold text-amber-200 mb-3">
                    Notes libres {isAll && '(non rattachées à une fiche)'}
                  </h2>

                  {showOnboarding ? (
                    <div className="text-center py-16 bg-neutral-950/40 rounded-3xl border border-amber-900/20 px-6 max-w-2xl mx-auto">
                      <p className="text-amber-200/60 font-serif text-lg mb-2">Commencez par créer une catégorie.</p>
                      <p className="text-xs text-amber-200/40 font-sans mb-6">
                        Une catégorie range vos notes : choisissez une suggestion ou tapez un nom.
                      </p>
                      <div className="text-left">
                        <CategoryQuickAdd existing={categories} onCreate={handleCreateCategory} />
                      </div>
                    </div>
                  ) : tabIdeas.length === 0 ? (
                    <div className="text-center py-12 bg-neutral-950/40 rounded-3xl border border-amber-900/20 px-6 max-w-2xl mx-auto my-6">
                      <p className="text-amber-200/60 font-serif mb-1">Aucune note libre ici.</p>
                      <p className="text-xs text-amber-200/40 font-sans">Créez une note indépendante via le bouton en haut.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {tabIdeas.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          onEdit={(ideaToEdit) => { setSelectedIdea(ideaToEdit); setIsModalOpen(true); }}
                          onDelete={(id, e) => handleDeleteIdea(id, e)}
                          onVersions={(ideaToOpen) => navigate(`/ideas/${ideaToOpen.id}/versions`)}
                        />
                      ))}
                    </div>
                  )}
                </section>

              </div>
            </div>
          );
        })}
      </div>

      {/* --- MODALES --- */}
      <IdeaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bookId={null}
        ideaToEdit={selectedIdea}
        defaultCategoryId={activeTab !== 'all' ? Number(activeTab) : null}
        onSuccess={() => refreshIdeas()}
      />

      <NewSheetModal
        isOpen={newSheetCategory !== null}
        category={newSheetCategory}
        onClose={() => setNewSheetCategory(null)}
        onCreated={(sheet) => {
          setNewSheetCategory(null);
          navigate(`/ideas/fiches/${sheet.id}`);
        }}
      />

      <ManageCategoriesModal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        categories={categories}
        onCreate={handleCreateCategory}
        onUpdate={updateCategory}
        onDelete={handleDeleteCategory}
        onContentChanged={async () => {
          await Promise.all([refreshIdeas(), refreshSheets()]);
        }}
      />
    </div>
  );
}