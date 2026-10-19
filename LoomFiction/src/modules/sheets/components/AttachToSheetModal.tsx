import { useEffect, useState } from 'react';
import type { BookResponse } from '../../../types/book';
import type { CategoryResponse } from '../../../types/category';
import type { IdeaResponse } from '../../../types/idea';
import type { SheetResponse } from '../../../types/sheet';
import { attachIdeasToSheet, bookOfSheet, foldText } from '../sheetLinks';

interface AttachToSheetModalProps {
  /** La note libre à rattacher ; null = modale fermée. */
  idea: IdeaResponse | null;
  sheets: SheetResponse[];
  categories: CategoryResponse[];
  books: BookResponse[];
  cardsBySheet: Map<number, IdeaResponse[]>;
  onClose: () => void;
  onAttached: () => void | Promise<void>;
}

/** Depuis une note libre : choisir la fiche dans laquelle elle devient une caractéristique. */
export function AttachToSheetModal({ idea, sheets, categories, books, cardsBySheet, onClose, onAttached }: AttachToSheetModalProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery('');
    setSelectedId(null);
    setError('');
  }, [idea?.id]);

  useEffect(() => {
    if (!idea) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idea, busy, onClose]);

  if (!idea) return null;

  const categoryOf = (id: number) => categories.find((c) => c.id === id);
  const bookTitle = (id: number | null) => (id == null ? null : books.find((b) => b.id === id)?.title ?? null);

  const q = foldText(query.trim());
  const rows = sheets
    .filter((sheet) => !q || foldText(sheet.name).includes(q))
    .sort(
      (a, b) =>
        Number(b.categoryId === idea.categoryId) - Number(a.categoryId === idea.categoryId) ||
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    );

  const selected = sheets.find((sheet) => sheet.id === selectedId) ?? null;
  const selectedCards = selected ? cardsBySheet.get(selected.id) ?? [] : [];
  const sheetBook = selected ? bookOfSheet(selectedCards) : null;

  const effects: string[] = [];
  if (selected) {
    if (selected.categoryId !== idea.categoryId) {
      effects.push(
        `Catégorie : « ${categoryOf(idea.categoryId)?.name ?? '—'} » → « ${categoryOf(selected.categoryId)?.name ?? '—'} » (celle de la fiche).`
      );
    }
    if (sheetBook != null && sheetBook !== idea.bookId) {
      const from = bookTitle(idea.bookId);
      effects.push(`Roman : ${from ? `« ${from} » → ` : ''}« ${bookTitle(sheetBook) ?? '—'} » (celui de la fiche).`);
    }
  }

  const confirm = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      await attachIdeasToSheet(selected, selectedCards, [idea]);
      await onAttached();
      onClose();
    } catch (err) {
      console.error('Erreur lors du rattachement à la fiche :', err);
      setError('Impossible de rattacher cette note.');
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
          <h2 className="font-serif text-xl font-bold text-amber-100">Rattacher à une fiche</h2>
          <p className="mt-1 truncate text-sm text-amber-200/60">« {idea.name} » deviendra une caractéristique de la fiche choisie.</p>
        </div>

        {sheets.length > 4 && (
          <input
            type="text"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="🔍 Rechercher une fiche..."
            className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2.5 font-serif text-sm text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        )}

        <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <p className="py-6 text-center font-serif text-sm text-amber-200/50">Aucune fiche ne correspond.</p>
          ) : (
            rows.map((sheet) => {
              const category = categoryOf(sheet.categoryId);
              const cards = cardsBySheet.get(sheet.id) ?? [];
              const book = bookTitle(bookOfSheet(cards));
              const active = sheet.id === selectedId;

              return (
                <button
                  key={sheet.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(sheet.id)}
                  className={`w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? 'border-amber-600 bg-amber-900/60 text-amber-50'
                      : 'border-amber-900/30 bg-neutral-900 text-amber-200 hover:border-amber-700/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category?.color ?? '#b45309' }} />
                    <span className="min-w-0 flex-1 truncate font-serif font-semibold">{sheet.name}</span>
                    {sheet.categoryId === idea.categoryId && (
                      <span className="shrink-0 rounded-full border border-amber-800/40 bg-amber-950 px-2 py-0.5 text-[10px] text-amber-300">
                        Même catégorie
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-amber-200/50">
                    {category?.name ?? '—'} · 📚 {book ?? 'Sans roman'} · {cards.length} {cards.length > 1 ? 'cartes' : 'carte'}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {effects.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-amber-900/30 bg-neutral-900/60 px-4 py-3 text-xs text-amber-200/80">
            {effects.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
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
            disabled={!selected || busy}
            className="cursor-pointer rounded-xl bg-amber-700 px-6 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Rattachement...' : 'Rattacher'}
          </button>
        </div>
      </div>
    </div>
  );
}