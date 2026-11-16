import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useIdeas } from '../hooks/useIdeas';
import { useDeleteIdea } from '../hooks/useDeleteIdea';
import { useCategories } from '../../categories/hooks/useCategories';
import { useSheets } from '../../sheets/hooks/useSheets';
import { offlineBookService } from '../../../services/offlineBookService';
import { notifyDataChanged, useDataChanged } from '../../../hooks/useDataChanged';
import { useExplorerOpen } from '../../../hooks/useExplorerOpen';

import type { IdeaResponse, IdeaStatus } from '../../../types/idea';
import type { BookResponse } from '../../../types/book';

import { IdeasFilters } from '../components/IdeasFilters';
import { IdeaModal } from '../components/IdeaModal';
import { IdeaCard } from '../components/IdeaCard';
import { AttachToSheetModal } from '../../sheets/components/AttachToSheetModal';
import { SheetExplorer } from '../../sheets/components/SheetExplorer';
import { IconBack, IconMenu } from '../../../components/icons';
import { useConfirm, useToast } from '../../../components/feedback/FeedbackProvider';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const NO_CATEGORY = 'none';


export function IsolatedIdeasPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const { ideas, setIdeas, isLoading, error, refreshIdeas } = useIdeas(null);
  const { deleteIdea } = useDeleteIdea();
  const { categories } = useCategories();
  const { sheets, refreshSheets } = useSheets();

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<IdeaResponse | null>(null);
  const [ideaToAttach, setIdeaToAttach] = useState<IdeaResponse | null>(null);

  const [search, setSearch] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isExplorerOpen, setIsExplorerOpen] = useExplorerOpen();

  useEffect(() => {
    offlineBookService
      .getAll()
      .then((data) => setBooks(data || []))
      .catch((err) => console.error('Erreur de chargement des romans :', err));
  }, []);

  useDataChanged((source) => {
    if (source === 'isolated-ideas') return;
    void refreshIdeas();
    void refreshSheets();
  });

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

  const isolated = useMemo(
    () =>
      ideas
        .filter((idea) => idea.sheetId == null)
        .map((idea) => ({
          ...idea,
          bookTitle: books.find((book) => book.id === idea.bookId)?.title ?? 'Roman non rattaché',
          sheetName: undefined as string | undefined,
        })),
    [ideas, books],
  );

  const query = search.trim().toLowerCase();
  const bookQuery = bookFilter.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      isolated.filter((idea) => {
        const matchesSearch =
          !query || idea.name.toLowerCase().includes(query) || (idea.description ?? '').toLowerCase().includes(query);
        const matchesBook = !bookQuery || idea.bookTitle.toLowerCase().includes(bookQuery);
        const matchesStatus = statusFilter === 'all' || idea.status === statusFilter;
        return matchesSearch && matchesBook && matchesStatus;
      }),
    [isolated, query, bookQuery, statusFilter],
  );

  const categoryKeyOf = (idea: IdeaResponse) =>
    categories.some((category) => category.id === idea.categoryId) ? String(idea.categoryId) : NO_CATEGORY;

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const idea of filtered) {
      const key = categoryKeyOf(idea);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, categories]);

  const groups = useMemo(() => {
    const entries = [
      ...categories.map((category) => ({
        key: String(category.id),
        label: category.name,
        color: category.color as string | undefined,
      })),
      { key: NO_CATEGORY, label: 'Sans catégorie', color: undefined },
    ];
    return entries
      .filter((entry) => categoryFilter === 'all' || categoryFilter === entry.key)
      .map((entry) => ({ ...entry, items: filtered.filter((idea) => categoryKeyOf(idea) === entry.key) }))
      .filter((entry) => entry.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, filtered, categoryFilter]);

  const handleDeleteIdea = async (ideaId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    const ok = await confirm({
      title: 'Supprimer cette note ?',
      message: 'Cette action est irréversible.',
      tone: 'danger',
    });
    if (!ok) return;

    const success = await deleteIdea(ideaId);
    if (success) {
      setIdeas(ideas.filter((idea) => idea.id !== ideaId));
      notifyDataChanged('isolated-ideas');
      toast.success('Note supprimée');
    } else {
      toast.error('Impossible de supprimer la note.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh grow items-center justify-center bg-[#1c1411]">
        <p className="animate-pulse font-serif text-lg italic text-amber-200/60">Ouverture du grimoire...</p>
      </div>
    );
  }

  if (error) return null;

  const chip = (active: boolean) =>
    `touch-target shrink-0 cursor-pointer whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs transition ${
      active
        ? 'border-amber-600 bg-amber-700 text-amber-50'
        : 'border-amber-900/40 bg-neutral-900 text-amber-200/70 hover:bg-neutral-800'
    }`;

  return (
    <div className="relative flex flex-1 grow items-start bg-[#1c1411] font-sans text-[#fcf9f2]">
      {/* Même explorateur que la page d'une fiche ; ici aucune fiche n'est « courante ». */}
      <SheetExplorer isOpen={isExplorerOpen} onClose={() => setIsExplorerOpen(false)} currentSheetId={null} />

      <div className="flex min-w-0 flex-1 flex-col self-stretch overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1700px] shrink-0 px-4 pt-6 sm:px-6 sm:pt-8 md:px-12">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/ideas')}
            className="touch-target flex cursor-pointer items-center gap-1 text-sm text-amber-200/60 transition-colors hover:text-amber-100"
          >
            <IconBack className="size-4" aria-hidden="true" />
            Carnet
          </button>
          {!isExplorerOpen && (
            <button
              type="button"
              onClick={() => setIsExplorerOpen(true)}
              title="Ouvrir l'explorateur"
              aria-label="Ouvrir l'explorateur"
              aria-expanded={isExplorerOpen}
              className="touch-target flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-900/40 bg-neutral-900 text-amber-200/70 shadow-md transition-colors hover:bg-amber-900/20 hover:text-amber-100 sm:size-9"
            >
              <IconMenu className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-amber-100 sm:text-4xl">Notes libres</h1>
            <p className="mt-1 text-sm text-amber-200/50">
              {plural(isolated.length, 'note')} non rattachée{isolated.length > 1 ? 's' : ''} à une fiche
              {filtered.length !== isolated.length && ` · ${plural(filtered.length, 'résultat')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedIdea(null);
              setIsModalOpen(true);
            }}
            className="touch-target w-full cursor-pointer rounded-xl border border-amber-600 bg-amber-700 px-4 py-2 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 sm:w-auto"
          >
            + Nouvelle note
          </button>
        </div>

        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
          <button type="button" onClick={() => setCategoryFilter('all')} className={chip(categoryFilter === 'all')}>
            Toutes ({filtered.length})
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryFilter(String(category.id))}
              className={`${chip(categoryFilter === String(category.id))} inline-flex items-center gap-1.5`}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name} ({countByCategory.get(String(category.id)) ?? 0})
            </button>
          ))}
          {(countByCategory.get(NO_CATEGORY) ?? 0) > 0 && (
            <button type="button" onClick={() => setCategoryFilter(NO_CATEGORY)} className={chip(categoryFilter === NO_CATEGORY)}>
              Sans catégorie ({countByCategory.get(NO_CATEGORY)})
            </button>
          )}
        </div>

        <IdeasFilters
          search={search}
          onSearchChange={setSearch}
          bookFilter={bookFilter}
          onBookFilterChange={setBookFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          books={books}
        />
      </div>

      <div className="mx-auto w-full max-w-[1700px] flex-1 space-y-6 px-4 py-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:space-y-8 sm:px-6 sm:pb-20 md:px-12">
        {groups.length === 0 ? (
          <div className="mx-auto my-6 max-w-2xl rounded-3xl border border-amber-900/20 bg-neutral-950/40 px-6 py-12 text-center">
            <p className="mb-1 font-serif text-amber-200/60">
              {isolated.length === 0 ? 'Aucune note libre pour le moment.' : 'Aucune note ne correspond à ces filtres.'}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 flex items-center gap-2 font-serif text-sm font-bold text-amber-200">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: group.color ?? '#78716c' }} />
                {group.label}
                <span className="text-xs font-normal text-amber-200/40">({group.items.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onEdit={(ideaToEdit) => {
                      setSelectedIdea(ideaToEdit);
                      setIsModalOpen(true);
                    }}
                    onDelete={(id, event) => handleDeleteIdea(id, event)}
                    onVersions={(ideaToOpen) => navigate(`/ideas/${ideaToOpen.id}/versions`)}
                    onAttach={() => setIdeaToAttach(idea)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <IdeaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bookId={null}
        ideaToEdit={selectedIdea}
        defaultCategoryId={categoryFilter !== 'all' && categoryFilter !== NO_CATEGORY ? Number(categoryFilter) : null}
        onSuccess={async () => {
          await refreshIdeas();
          notifyDataChanged('isolated-ideas');
        }}
      />

      <AttachToSheetModal
        idea={ideaToAttach}
        sheets={sheets}
        categories={categories}
        books={books}
        cardsBySheet={cardsBySheet}
        onClose={() => setIdeaToAttach(null)}
        onAttached={async () => {
          await refreshIdeas();
          await refreshSheets();
          notifyDataChanged('isolated-ideas');
        }}
      />
      </div>
    </div>
  );
}

export default IsolatedIdeasPage;