import { useState } from 'react';
import { useUpdateBook } from '../hooks/useUpdateBook';
import type { BookResponse } from '../../../types/book';
import { CoverImageField } from '../../../components/images/CoverImageField';

interface BookEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: BookResponse | null;
  onBookUpdated: (updatedBooksList: BookResponse[]) => void;
}

export function BookEditModal({ isOpen, onClose, book, onBookUpdated }: BookEditModalProps) {
  const [title, setTitle] = useState(book?.title || '');
  const [description, setDescription] = useState(book?.description || '');
  const [coverImage, setCoverImage] = useState(book?.coverImage || '');
  const [urlError, setUrlError] = useState<string | null>(null);
  
  const { updateBook, isUpdating, error } = useUpdateBook();

  const [prevInputs, setPrevInputs] = useState({ book, isOpen });
  if (prevInputs.book !== book || prevInputs.isOpen !== isOpen) {
    setPrevInputs({ book, isOpen });
    if (book) {
      setTitle(book.title || '');
      setDescription(book.description || '');
      setCoverImage(book.coverImage || '');
      setUrlError(null);
    }
  }

  if (!isOpen || !book) return null;

  const validateUrl = (url: string) => {
    if (!url.trim()) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (coverImage && !validateUrl(coverImage)) {
      setUrlError("Veuillez entrer une URL valide.");
      return;
    }
    setUrlError(null);

    const updatedBooksList = await updateBook(book.id, title, description, coverImage);
    if (updatedBooksList) {
      onBookUpdated(updatedBooksList);
      onClose();
    } else {
      alert(error || "Erreur lors de la modification du roman.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-[#1c1411] border border-amber-900/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-amber-50">
        
        <div className="flex justify-between items-center mb-6 pb-3 border-b border-amber-900/30">
          <h2 className="text-2xl font-serif font-bold text-amber-100">Modifier le Grimoire</h2>
          <button 
            onClick={onClose}
            className="text-amber-200/50 hover:text-amber-100 font-serif text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-serif uppercase tracking-wider text-amber-200/60 mb-1">
              Titre du roman <span className="text-red-400">*</span>
            </label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-serif uppercase tracking-wider text-amber-200/60 mb-1">
              Description (Synopsis)
            </label>
            <textarea 
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-sm resize-none"
            />
          </div>

          <CoverImageField
            value={coverImage}
            onChange={(value) => {
              setCoverImage(value);
              if (urlError) setUrlError(null);
            }}
            error={urlError}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-amber-900/30">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-amber-900/30 text-amber-200/70 text-sm font-medium hover:bg-neutral-900 transition cursor-pointer"
            >
              Annuler
            </button>
            <button 
              type="submit"
              disabled={isUpdating}
              className="bg-amber-700 hover:bg-amber-600 text-amber-50 px-5 py-2 rounded-xl text-sm font-medium transition shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isUpdating ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}