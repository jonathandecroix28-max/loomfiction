import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIdeas } from '../hooks/useIdeas';
import { useDeleteIdea } from '../hooks/useDeleteIdea';
import { useCategories } from '../../categories/hooks/useCategories';
import { useSheets } from '../../sheets/hooks/useSheets';
import { offlineBookService } from '../../../services/offlineBookService';
import { IdeaModal } from '../components/IdeaModal';
import { IdeaCard } from '../components/IdeaCard';
import { ManageCategoriesModal } from '../../categories/components/ManageCategoriesModal';
import { CategoryQuickAdd } from '../../categories/components/CategoryQuickAdd';
import { SheetCard } from '../../sheets/components/SheetCard';
import { bookOfSheet } from '../../sheets/sheetLinks';
import { NewSheetModal } from '../../sheets/components/NewSheetModal';
import type { IdeaResponse, IdeaStatus } from '../../../types/idea';
import type { BookResponse } from '../../../types/book';
import type { CategoryResponse, CategoryUpsertRequest } from '../../../types/category';
import type { SheetResponse } from '../../../types/sheet';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export function IdeasPage() {
  const navigate = useNavigate();

  const { ideas, setIdeas, isLoading: areIdeasLoading, error: ideasError, refreshIdeas } = useIdeas(null);
  const { deleteIdea } = useDeleteIdea();
  const {
    categories,
    isLoading: areCategoriesLoading,
    createCategory,
    updateCategory,
    deleteCategory,
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
      { id: 'all', label: 'Toutes les notes' },
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

  // Une catégorie tout juste créée devient l'onglet actif dès que la liste est à jour
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
    !search ||
    idea.name.toLowerCase().includes(search) ||
    (idea.description ?? '').toLowerCase().includes(search);

  // La recherche porte aussi sur le contenu des cartes ; les filtres roman et statut ne concernent que les notes
  const sheetMatches = (sheet: SheetResponse) => {
    const cards = cardsBySheet.get(sheet.id) ?? [];
    const sheetBookId = bookOfSheet(cards);
    const sheetBookTitle = sheetBookId == null ? 'sans roman' : books.find((book) => book.id === sheetBookId)?.title ?? 'roman non rattaché';
    const matchesQuery =
      !search ||
      sheet.name.toLowerCase().includes(search) ||
      cards.some(matchesSearch);
    const matchesBook =
      !bookTitleFilter.trim() || sheetBookTitle.toLowerCase().includes(bookTitleFilter.trim().toLowerCase());
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

  const handleDelete = async (ideaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer cette note ?')) return;

    const success = await deleteIdea(ideaId);
    if (success) {
      setIdeas(ideas.filter((i) => i.id !== ideaId));
    } else {
      alert('Impossible de supprimer.');
    }
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

      {/* En-tête fixe et barre d'onglets globaux */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 md:px-12 shrink-0">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-amber-100 tracking-tight leading-tight">
            Carnet d'Inspiration Global
          </h1>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-auto w-full md:w-auto">
            <button
              onClick={() => setIsManageCategoriesOpen(true)}
              className="bg-neutral-900 hover:bg-neutral-800 text-amber-200 border border-amber-900/40 font-medium px-4 py-2.5 rounded-xl transition text-sm cursor-pointer shadow-sm inline-flex items-center justify-center gap-1.5 w-full sm:w-auto touch-target"
            >
              <span>⚙️</span> Gérer les catégories
            </button>

            <button
              onClick={() => { setSelectedIdea(null); setIsModalOpen(true); }}
              className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium px-5 py-2.5 rounded-xl transition text-sm cursor-pointer shadow-md inline-flex items-center justify-center gap-2 w-full sm:w-auto touch-target"
            >
              <span>+</span> Nouvelle note
            </button>
          </div>
        </div>

        {/* 📑 Onglets dynamiques générés depuis les catégories */}
        <div className="flex items-center gap-4 sm:gap-8 border-b border-amber-900/40 mb-6 overflow-x-auto text-sm font-serif scrollbar-none pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => goToTab(tab.id)}
              className={`pb-3 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeTab === tab.id ? 'text-amber-400 border-b-2 border-amber-400 font-bold' : 'text-amber-200/60 hover:text-amber-200'}`}
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

        {/* 🔍 Barre de filtres */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6">
          <input
            type="text"
            placeholder="🔍 Rechercher dans les notes et les fiches..."
            value={ideaSearch}
            onChange={(e) => setIdeaSearch(e.target.value)}
            className="w-full sm:w-96 bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif placeholder:text-amber-200/30"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <input
              type="text"
              placeholder="📚 Filtrer par titre de roman..."
              value={bookTitleFilter}
              onChange={(e) => setBookTitleFilter(e.target.value)}
              className="w-full sm:w-64 bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif placeholder:text-amber-200/30 touch-target"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as IdeaStatus | 'all')}
              className="bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-sm text-amber-200/80 focus:outline-none font-serif cursor-pointer touch-target"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">💡 Brutes</option>
              <option value="in-progress">🛠️ En cours</option>
              <option value="integrated">✅ Intégrées</option>
            </select>
          </div>
        </div>
      </div>

      {/* ↔️ Conteneur de glissement horizontal */}
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

          // Dans une catégorie, les cartes de fiches n'apparaissent que dans leur fiche
          const tabIdeas = ideasWithDetails.filter((idea) => {
            const matchesBookTitle =
              bookTitleFilter === '' || idea.bookTitle.toLowerCase().includes(bookTitleFilter.toLowerCase());
            const matchesStatus = statusFilter === 'all' || idea.status === statusFilter;
            const matchesTab = isAll || (String(idea.categoryId) === tab.id && idea.sheetId == null);
            return matchesSearch(idea) && matchesBookTitle && matchesStatus && matchesTab;
          });

          const tabSheets = isAll
            ? []
            : sheets.filter((sheet) => String(sheet.categoryId) === tab.id && sheetMatches(sheet));

          const summary = isAll
            ? plural(tabIdeas.length, 'élément')
            : `${plural(tabSheets.length, 'fiche')} · ${plural(tabIdeas.length, 'note')}`;

          const showOnboarding = isAll && tabIdeas.length === 0 && !areCategoriesLoading && categories.length === 0;

          return (
            <div
              key={tab.id}
              className="w-full min-w-full shrink-0 snap-start px-4 sm:px-6 md:px-12 py-4 flex flex-col"
            >
              <div className="w-full max-w-[1700px] mx-auto flex-1 space-y-8 pb-20">
                <div className="text-xs uppercase tracking-wider text-amber-200/40 font-serif font-semibold">
                  {tab.label} &bull; {summary}
                </div>

                {category && (
                  <section>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="text-sm font-serif font-bold text-amber-200 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                        Fiches
                      </h2>
                      <button
                        onClick={() => setNewSheetCategory(category)}
                        className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium px-4 py-2 rounded-xl transition text-xs cursor-pointer shadow-md touch-target"
                      >
                        + Nouvelle fiche
                      </button>
                    </div>

                    {tabSheets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-amber-900/30 px-6 py-8 text-center">
                        <p className="text-amber-200/60 font-serif">Aucune fiche pour le moment.</p>
                        <p className="text-xs text-amber-200/40 mt-1">
                          Une fiche rassemble plusieurs cartes (apparence, histoire…) en une seule page.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {tabSheets.map((sheet) => {
                          const cards = cardsBySheet.get(sheet.id) ?? [];
                          return (
                            <SheetCard
                              key={sheet.id}
                              sheet={sheet}
                              color={category.color}
                              total={cards.length}
                              filled={cards.filter((card) => card.description?.trim()).length}
                              bookTitle={(() => {
                                const bookId = bookOfSheet(cards);
                                return bookId == null ? 'Sans roman' : books.find((book) => book.id === bookId)?.title ?? 'Roman inconnu';
                              })()}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                <section>
                  {category && (
                    <h2 className="text-sm font-serif font-bold text-amber-200 mb-3">Notes libres</h2>
                  )}

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
                    category ? (
                      <p className="text-xs text-amber-200/40 font-serif">Aucune note libre dans cette catégorie.</p>
                    ) : (
                      <div className="text-center py-24 bg-neutral-950/40 rounded-3xl border border-amber-900/20 px-6 max-w-2xl mx-auto my-12">
                        <p className="text-amber-200/60 font-serif text-lg mb-2">Aucune note dans cette section.</p>
                        <p className="text-xs text-amber-200/40 font-sans">Modifiez vos filtres ou créez une nouvelle note.</p>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {tabIdeas.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          onEdit={(ideaToEdit) => { setSelectedIdea(ideaToEdit); setIsModalOpen(true); }}
                          onDelete={(id, e) => handleDelete(id, e)}
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

      {/* Modales */}
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