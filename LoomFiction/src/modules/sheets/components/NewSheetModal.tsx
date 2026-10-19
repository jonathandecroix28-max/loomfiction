import { useEffect, useState, type FormEvent } from 'react';
import type { CategoryResponse } from '../../../types/category';
import type { SheetResponse } from '../../../types/sheet';
import { createSheetFromTemplate, templateFor } from '../../../services/createSheetFromTemplate';

interface NewSheetModalProps {
  isOpen: boolean;
  category: CategoryResponse | null;
  onClose: () => void;
  onCreated: (sheet: SheetResponse) => void;
}

export function NewSheetModal({ isOpen, category, onClose, onCreated }: NewSheetModalProps) {
  const [name, setName] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setUseTemplate(true);
    setError('');
  }, [isOpen]);

  if (!isOpen || !category) return null;

  const titles = templateFor(category);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;

    setBusy(true);
    setError('');
    try {
      const sheet = await createSheetFromTemplate(category, name, useTemplate && titles.length > 0);
      onCreated(sheet);
    } catch (err) {
      console.error('Erreur lors de la création de la fiche :', err);
      setError('Impossible de créer la fiche.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-3xl border border-amber-900/40 bg-[#1c1411] p-6 font-sans text-amber-50 shadow-2xl md:p-8"
      >
        <h2 className="font-serif text-xl font-bold text-amber-100">
          Nouvelle fiche <span style={{ color: category.color }}>· {category.name}</span>
        </h2>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
            Nom de la fiche
          </label>
          <input
            type="text"
            value={name}
            autoFocus
            required
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Elara, Port-Sombre, l'Épée de cendre…"
            className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-3 font-serif text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {titles.length > 0 ? (
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-200/80">
              <input type="checkbox" checked={useTemplate} onChange={(event) => setUseTemplate(event.target.checked)} />
              Créer avec les cartes types
            </label>
            {useTemplate && (
              <div className="flex flex-wrap gap-1.5">
                {titles.map((title) => (
                  <span key={title} className="rounded-full border border-amber-900/40 bg-neutral-900 px-2.5 py-1 text-xs text-amber-200/70">
                    {title}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-amber-200/40">
            Cette catégorie n'a pas de cartes types : la fiche démarre vide. Vous pouvez en définir dans « Gérer les catégories ».
          </p>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-amber-900/30 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium text-amber-200/70 transition hover:bg-neutral-900"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="cursor-pointer rounded-xl bg-amber-700 px-6 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:opacity-50"
          >
            {busy ? 'Création...' : 'Créer la fiche'}
          </button>
        </div>
      </form>
    </div>
  );
}