import { useState, useEffect } from 'react';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineBookService } from '../../../services/offlineBookService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { useCategories } from '../../categories/hooks/useCategories';
import type { SheetResponse } from '../../../types/sheet';
import type { BookResponse } from '../../../types/book';
import type { IdeaResponse, IdeaStatus } from '../../../types/idea';
import { useToast } from '../../../components/feedback/FeedbackProvider';
import { notifyDataChanged } from '../../../hooks/useDataChanged';
import { IconClose } from '../../../components/icons';
import { bookOfSheet, toUpsert } from '../sheetLinks';

type SheetConfigModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sheet: SheetResponse;
  cards: IdeaResponse[];
  onSuccess: () => void;
};

// Le formulaire est monté uniquement quand la modale est ouverte : son état
// est ainsi réinitialisé à chaque ouverture à partir des props.
export function SheetConfigModal(props: SheetConfigModalProps) {
  if (!props.isOpen) return null;
  return <SheetConfigForm {...props} />;
}

function SheetConfigForm({ onClose, sheet, cards, onSuccess }: SheetConfigModalProps) {
  const toast = useToast();
  const { categories } = useCategories();

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [name, setName] = useState(sheet.name);
  const [categoryId, setCategoryId] = useState(sheet.categoryId);
  const [selectedBookId, setSelectedBookId] = useState<string>(() => {
    const currentBookId = bookOfSheet(cards);
    return currentBookId !== null ? String(currentBookId) : 'none';
  });
  const [status, setStatus] = useState<IdeaStatus>(cards[0]?.status || 'draft');

  useEffect(() => {
    const loadBooks = async () => {
      try {
        const booksData = await offlineBookService.getAll();
        setBooks(booksData || []);
      } catch (err) {
        console.error('Erreur chargement livres :', err);
      }
    };

    void loadBooks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await offlineSheetService.update(sheet.id, {
        name: name.trim(),
        categoryId,
      });

      const newBookId = selectedBookId === 'none' ? null : Number(selectedBookId);
      
      if (cards.length > 0) {
        for (const card of cards) {
          await offlineIdeaService.update(card.id, {
            ...toUpsert(card),
            categoryId,
            bookId: newBookId,
            status,
          });
        }
      } else {
        await offlineIdeaService.create({
          name: 'Caractéristique principale',
          description: '',
          categoryId,
          sheetId: sheet.id,
          bookId: newBookId,
          status,
          sortOrder: 0,
        });
      }

      notifyDataChanged('sheet-page');

      toast.success('Configuration de la fiche mise à jour');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la fiche :', err);
      toast.error('Impossible de modifier la fiche.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-900/40 bg-[#1c1411] p-6 text-[#fcf9f2] shadow-2xl font-serif">
        <div className="flex items-center justify-between pb-4 border-b border-amber-900/40 mb-4">
          <h2 className="text-xl font-bold text-amber-100">Configuration de la fiche</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-amber-200/60 hover:bg-amber-900/30 hover:text-amber-100 cursor-pointer"
          >
            <IconClose className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div>
            <label className="block text-xs uppercase tracking-wider text-amber-200/60 mb-1">
              Nom de la fiche
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-amber-200/60 mb-1">
              Roman rattaché
            </label>
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif"
            >
              <option value="none">Non rattaché à un roman</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-amber-200/60 mb-1">
              Catégorie
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-amber-200/60 mb-1">
              Statut global de la fiche
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IdeaStatus)}
              className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif"
            >
              <option value="draft">Brouillon</option>
              <option value="in-progress">En cours</option>
              <option value="integrated">Intégré</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-amber-900/30 bg-neutral-900 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-neutral-800 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-xl border border-amber-600 bg-amber-700 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-600 cursor-pointer shadow-md"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SheetConfigModal;