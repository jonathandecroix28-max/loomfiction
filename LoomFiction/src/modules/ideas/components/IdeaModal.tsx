import { useState, useEffect } from 'react';
import { useCreateIdea } from '../hooks/useCreateIdea';
import { useUpdateIdea } from '../hooks/useUpdateIdea';
import { offlineBookService } from '../../../services/offlineBookService';
import { offlineCategoryService } from '../../../services/offlineCategoryService';
import type { IdeaResponse, IdeaUpsertRequest, IdeaStatus } from '../../../types/idea';
import type { BookResponse } from '../../../types/book';
import type { CategoryResponse } from '../../../types/category';

interface IdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: number | null;
  ideaToEdit?: IdeaResponse | null;
  /** Création d'une carte dans une fiche */
  sheetId?: number | null;
  sortOrder?: number;
  /** Catégorie imposée (celle de la fiche) */
  lockedCategoryId?: number | null;
  /** Catégorie présélectionnée pour une nouvelle note libre */
  defaultCategoryId?: number | null;
  onSuccess: (updatedIdeas: IdeaResponse[]) => void;
}

const templates = {
  personnage: {
    label: '👤 Personnage',
    text: 'Nom:\nÂge:\nObjectif:\nSecret:\nApparence:\nTraits de caractère:\n',
  },
  intrigue: {
    label: '⚡ Rebondissement',
    text: "Situation initiale:\nL'élément perturbateur:\nAction(s) entreprise(s):\nConséquence:\n",
  },
  univers: {
    label: '🌍 Lieu / Lore',
    text: 'Nom du lieu:\nAtmosphère/Ambiance:\nParticularité/Règle magique:\nDanger potentiel:\n',
  },
};

export function IdeaModal({
  isOpen,
  onClose,
  bookId,
  ideaToEdit,
  sheetId,
  sortOrder,
  lockedCategoryId,
  defaultCategoryId,
  onSuccess,
}: IdeaModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [status, setStatus] = useState<IdeaStatus>('draft');
  const [selectedBookId, setSelectedBookId] = useState<number>(bookId || 0);

  const [books, setBooks] = useState<BookResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isListening, setIsListening] = useState(false);

  const { createIdea, isCreating } = useCreateIdea();
  const { updateIdea, isUpdating } = useUpdateIdea();

  // Une carte de fiche garde la catégorie de sa fiche
  const categoryLocked =
    lockedCategoryId != null || ideaToEdit?.sheetId != null;
  const isCard = !!sheetId || ideaToEdit?.sheetId != null;

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        offlineBookService.getAll().catch(() => []),
        offlineCategoryService.getAll().catch(() => []),
      ]).then(([booksData, catsData]) => {
        setBooks(booksData || []);
        setCategories(catsData || []);

        if (catsData && catsData.length > 0 && categoryId === 0 && !ideaToEdit) {
          setCategoryId(
            lockedCategoryId ?? defaultCategoryId ?? catsData[0].id,
          );
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (ideaToEdit) {
      setName(ideaToEdit.name);
      setDescription(ideaToEdit.description || '');
      setCategoryId(ideaToEdit.categoryId);
      setStatus(ideaToEdit.status || 'draft');
      setSelectedBookId(ideaToEdit.bookId || 0);
    } else {
      setName('');
      setDescription('');
      setStatus('draft');
      setSelectedBookId(bookId || 0);

      const fallback =
        lockedCategoryId ?? defaultCategoryId ?? categories[0]?.id;

      if (fallback) {
        setCategoryId(fallback);
      }
    }
  }, [
    ideaToEdit,
    isOpen,
    bookId,
    categories,
    lockedCategoryId,
    defaultCategoryId,
  ]);

  if (!isOpen) return null;

  const handleVoiceDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("La dictée vocale n'est pas supportée par votre navigateur.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription((prev) =>
        prev ? `${prev} ${transcript}` : transcript,
      );
    };

    recognition.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    if (!categoryId || categoryId === 0) {
      alert('Veuillez sélectionner une catégorie valide.');
      return;
    }

    const targetBookId =
      bookId && bookId !== 0 ? bookId : selectedBookId;

    const data: IdeaUpsertRequest = {
      name,
      description,
      bookId:
        targetBookId && targetBookId !== 0
          ? Number(targetBookId)
          : null,
      categoryId: Number(categoryId),
      status,

      ...(ideaToEdit ? {} : { sheetId: sheetId ?? undefined, sortOrder }),
    };

    let result: IdeaResponse[] | null = null;

    if (ideaToEdit) {
      result = await updateIdea(ideaToEdit.id, data);
    } else {
      result = await createIdea(data);
    }

    if (result) {
      onSuccess(result);
      onClose();
    } else {
      alert("Une erreur est survenue lors de l'enregistrement de l'idée.");
    }
  };

  const isLoading = isCreating || isUpdating;
  const lockedCategoryName = categories.find(
    (cat) => cat.id === categoryId,
  )?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-2 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="my-2 max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-amber-900/40 bg-[#1c1411] p-4 text-amber-50 shadow-2xl sm:my-8 sm:max-h-[calc(100dvh-4rem)] sm:rounded-3xl sm:p-8">
        <h2 className="mb-6 font-serif text-2xl font-bold text-amber-100">
          {ideaToEdit
            ? 'Modifier la note'
            : isCard
              ? 'Nouvelle caractéristique'
              : 'Nouvelle idée de grimoire'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5 font-sans">
          {(!bookId || bookId === 0) && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
                Roman associé (optionnel)
              </label>

              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(Number(e.target.value))}
                className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-3 font-serif text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value={0}>-- Aucun roman associé (Global) --</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
              Type de note / Catégorie
            </label>

            {categoryLocked ? (
              <div className="w-full rounded-xl border border-amber-900/30 bg-neutral-900/60 px-4 py-3 font-serif text-sm text-amber-100/80">
                {lockedCategoryName ?? '—'}
                <span className="ml-2 text-xs text-amber-200/40">
                  (catégorie de la fiche)
                </span>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                required
                className="w-full cursor-pointer rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-3 font-serif text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {categories.length === 0 ? (
                  <option value={0} disabled>
                    -- Aucune catégorie disponible --
                  </option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
              {isCard ? 'Titre de la caractéristique' : "Titre de l'idée"}
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isCard
                  ? 'Ex: Apparence, Passé, Motivation...'
                  : 'Ex: Le secret du grimoire maudit...'
              }
              required
              className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-3 font-serif text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
                Description / Notes
              </label>

              <div className="flex shrink-0 gap-2">
                <select
                  defaultValue=""
                  aria-label="Ajouter un modèle"
                  onChange={(e) => {
                    const val = e.target.value as keyof typeof templates;

                    if (val) {
                      setDescription((prev) =>
                        prev
                          ? `${prev}\n\n${templates[val].text}`
                          : templates[val].text,
                      );
                    }

                    e.target.value = '';
                  }}
                  className="cursor-pointer rounded-lg border border-amber-800/50 bg-amber-950/80 px-2 py-1.5 text-[10px] font-medium text-amber-200 hover:bg-amber-900"
                >
                  <option value="">+ Modèle</option>
                  {Object.entries(templates).map(([key, template]) => (
                    <option key={key} value={key}>
                      {template.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleVoiceDictation}
                  className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    isListening
                      ? 'animate-pulse border-red-800 bg-red-950 text-red-300'
                      : 'border-amber-800/50 bg-amber-950 text-amber-200 hover:bg-amber-900'
                  }`}
                  title="Dicter votre idée par la voix"
                  aria-label={
                    isListening ? 'Arrêter la dictée' : 'Dicter votre idée'
                  }
                >
                  <span aria-hidden="true">🎙️</span>
                  <span>{isListening ? 'Écoute...' : 'Dicter'}</span>
                </button>
              </div>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isListening
                  ? 'Je vous écoute...'
                  : "Détails de l'idée, texte long..."
              }
              rows={5}
              className="w-full resize-y rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-3 font-serif leading-relaxed text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
              Statut
            </label>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IdeaStatus)}
              className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-3 py-3 font-serif text-sm text-amber-100 focus:outline-none"
            >
              <option value="draft">💡 Brute</option>
              <option value="in-progress">🛠️ En cours</option>
              <option value="integrated">✅ Intégrée</option>
            </select>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-amber-900/30 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="min-h-11 w-full cursor-pointer justify-center rounded-xl px-5 py-2.5 text-sm font-medium text-amber-200/70 transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-11 w-full cursor-pointer justify-center rounded-xl bg-amber-700 px-6 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isLoading
                ? 'Enregistrement...'
                : ideaToEdit
                  ? 'Mettre à jour'
                  : 'Créer la note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}