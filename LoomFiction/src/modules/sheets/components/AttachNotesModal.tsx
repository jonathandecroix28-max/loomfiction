import { useEffect, useMemo, useState } from 'react';
import { offlineBookService } from '../../../services/offlineBookService';
import { offlineCategoryService } from '../../../services/offlineCategoryService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import type { BookResponse } from '../../../types/book';
import type { CategoryResponse } from '../../../types/category';
import type { IdeaResponse } from '../../../types/idea';
import type { SheetResponse } from '../../../types/sheet';
import { attachIdeasToSheet, foldText } from '../sheetLinks';

interface AttachNotesModalProps {
  isOpen: boolean;
  sheet: SheetResponse;
  cards: IdeaResponse[];
  onClose: () => void;
  onAttached: () => void | Promise<void>;
}

const excerpt = (text?: string | null) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);

/** Depuis une fiche : piocher dans les notes libres pour en faire des caractéristiques. */
export function AttachNotesModal({ isOpen, sheet, cards, onClose, onAttached }: AttachNotesModalProps) {
  const [notes, setNotes] = useState<IdeaResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [books, setBooks] = useState<BookResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sameCategory, setSameCategory] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setQuery('');
    setSameCategory(true);
    setSelected(new Set());
    setError('');

    Promise.all([
      offlineIdeaService.getAll(),
      offlineCategoryService.getAll().catch(() => []),
      offlineBookService.getAll().catch(() => []),
    ])
      .then(([ideas, cats, bks]) => {
        if (cancelled) return;
        setNotes(
          (ideas ?? [])
            .filter((idea) => idea.sheetId == null)
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        );
        setCategories(cats ?? []);
        setBooks(bks ?? []);
      })
      .catch((err) => {
        console.error('Erreur de chargement des notes :', err);
        if (!cancelled) setError('Impossible de charger les notes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  const q = foldText(query.trim());
  const visible = useMemo(
    () =>
      notes.filter(
        (note) =>
          (!sameCategory || note.categoryId === sheet.categoryId) &&
          (!q || foldText(`${note.name}\n${note.description ?? ''}`).includes(q))
      ),
    [notes, sameCategory, sheet.categoryId, q]
  );

  if (!isOpen) return null;

  const categoryOf = (id: number) => categories.find((c) => c.id === id);
  const bookTitle = (id: number | null) => (id == null ? null : books.find((b) => b.id === id)?.title ?? null);

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = notes.filter((note) => selected.has(note.id));
  const otherCategory = chosen.filter((note) => note.categoryId !== sheet.categoryId).length;

  const confirm = async () => {
    if (chosen.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await attachIdeasToSheet(sheet, cards, chosen);
      await onAttached();
      onClose();
    } catch (err) {
      console.error('Erreur lors du rattachement des notes :', err);
      setError('Impossible de rattacher ces notes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg space-y-4 rounded-3xl border border-amber-900/40 bg-[#1c1411] p-6 font-sans text-amber-50 shadow-2xl md:p-8"
      >
        <div>
          <h2 className="font-serif text-xl font-bold text-amber-100">Ajouter des notes existantes</h2>
          <p className="mt-1 truncate text-sm text-amber-200/60">Elles deviendront des caractéristiques de « {sheet.name} ».</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="🔍 Rechercher une note..."
            className="min-w-0 flex-1 rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2.5 font-serif text-sm text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-amber-200/80">
            <input type="checkbox" checked={sameCategory} onChange={(event) => setSameCategory(event.target.checked)} />
            Même catégorie
          </label>
        </div>

        <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <p className="py-6 text-center font-serif text-sm text-amber-200/50">Chargement…</p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center font-serif text-sm text-amber-200/50">
              {notes.length === 0 ? 'Aucune note libre à rattacher.' : 'Aucune note ne correspond.'}
            </p>
          ) : (
            visible.map((note) => {
              const active = selected.has(note.id);
              const category = categoryOf(note.categoryId);
              const book = bookTitle(note.bookId);

              return (
                <label
                  key={note.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                    active ? 'border-amber-600 bg-amber-900/60' : 'border-amber-900/30 bg-neutral-900 hover:border-amber-700/60'
                  }`}
                >
                  <input type="checkbox" checked={active} onChange={() => toggle(note.id)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif font-semibold text-amber-100">{note.name}</p>
                    {note.description?.trim() && <p className="mt-0.5 line-clamp-2 text-xs text-amber-200/60">{excerpt(note.description)}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-amber-200/50">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category?.color ?? '#b45309' }} />
                        {category?.name ?? '—'}
                      </span>
                      {book && <span>📚 {book}</span>}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {otherCategory > 0 && (
          <p className="rounded-xl border border-amber-900/30 bg-neutral-900/60 px-4 py-3 text-xs text-amber-200/80">
            {otherCategory} {otherCategory > 1 ? 'notes changeront' : 'note changera'} de catégorie pour prendre celle de la fiche.
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
            type="button"
            onClick={() => void confirm()}
            disabled={chosen.length === 0 || busy}
            className="cursor-pointer rounded-xl bg-amber-700 px-6 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Rattachement...' : chosen.length > 0 ? `Rattacher (${chosen.length})` : 'Rattacher'}
          </button>
        </div>
      </div>
    </div>
  );
}