import { useState, useEffect } from 'react';
import { useCreateBook } from '../hooks/useCreateBook';
import { useCoverImage } from '../../../hooks/useCoverImage'; 
import type { BookResponse } from '../../../types/book';
import { CoverImageField } from '../../../components/CoverImageField';

interface BookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookCreated: (newBooksList: BookResponse[]) => void;
}

export function BookModal({ isOpen, onClose, onBookCreated }: BookModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const { url: coverImage, setUrl: setCoverImage, error: urlError, validate } = useCoverImage('');
  const { createBook, isCreating, error } = useCreateBook();

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setCoverImage('');
    }
  }, [isOpen, setCoverImage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!validate()) return;

    const updatedBooks = await createBook(title, description, coverImage);
    if (updatedBooks) {
      onBookCreated(updatedBooks); 
      onClose();
    } else {
      alert(error || "Erreur lors de la création du roman.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-[#1c1411] border border-amber-900/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-amber-50">
        
        <div className="flex justify-between items-center mb-6 pb-3 border-b border-amber-900/30">
          <h2 className="text-2xl font-serif font-bold text-amber-100">Nouveau Grimoire</h2>
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
              placeholder="Ex: Les Chroniques d'Onyx"
              className="w-full bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-amber-100 placeholder-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-sm"
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
              placeholder="De quoi parle votre histoire..."
              className="w-full bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-amber-100 placeholder-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans text-sm resize-none"
            />
          </div>

          <CoverImageField value={coverImage} onChange={setCoverImage} error={urlError} />

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
              disabled={isCreating}
              className="bg-amber-700 hover:bg-amber-600 text-amber-50 px-5 py-2 rounded-xl text-sm font-medium transition shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? "Création..." : "Poser la première pierre"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}