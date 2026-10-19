import { useEffect, useState } from 'react';
import type { CategoryResponse, CategoryUpsertRequest } from '../../../types/category';
import {
  countCategoryContent,
  deleteCategoryContent,
  moveCategoryContent,
  type CategoryContent,
} from '../../../services/categoryContent';
import { CategoryQuickAdd } from './CategoryQuickAdd';
import { nameKey, presetFor } from '../categoryPresets';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryResponse[];
  onCreate: (data: CategoryUpsertRequest) => Promise<unknown>;
  onUpdate: (id: number, data: CategoryUpsertRequest) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
  onContentChanged: () => void | Promise<void>;
}

type Draft = { name: string; color: string; template: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const parseTemplate = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

function describeContent(content: CategoryContent): string {
  const parts: string[] = [];
  if (content.sheets) parts.push(`${plural(content.sheets, 'fiche')} (${plural(content.cards, 'carte')})`);
  if (content.notes) parts.push(plural(content.notes, 'note'));
  return parts.join(' et ');
}

const isEmpty = (content: CategoryContent) => content.sheets + content.cards + content.notes === 0;

const ghostBtn =
  'cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50';

export function ManageCategoriesModal({
  isOpen,
  onClose,
  categories,
  onCreate,
  onUpdate,
  onDelete,
  onContentChanged,
}: ManageCategoriesModalProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', color: '#b45309', template: '' });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [content, setContent] = useState<CategoryContent | null>(null);
  const [moveTo, setMoveTo] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setEditingId(null);
    setDeletingId(null);
    setError('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const startEdit = (category: CategoryResponse) => {
    const template = category.template?.length ? category.template : presetFor(category.name)?.template ?? [];
    setDeletingId(null);
    setError('');
    setEditingId(category.id);
    setDraft({ name: category.name, color: category.color || '#b45309', template: template.join('\n') });
  };

  const saveEdit = async (category: CategoryResponse) => {
    const name = draft.name.trim();
    if (!name) return;
    if (categories.some((other) => other.id !== category.id && nameKey(other.name) === nameKey(name))) {
      setError('Une catégorie porte déjà ce nom.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onUpdate(category.id, { name, color: draft.color, template: parseTemplate(draft.template) });
      setEditingId(null);
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la catégorie :', err);
      setError('Impossible d’enregistrer la catégorie.');
    } finally {
      setBusy(false);
    }
  };

  const startDelete = async (category: CategoryResponse) => {
    setEditingId(null);
    setError('');
    setDeletingId(category.id);
    setContent(null);
    setMoveTo(0);
    try {
      setContent(await countCategoryContent(category.id));
    } catch (err) {
      console.error('Erreur lors de l’analyse de la catégorie :', err);
      setContent({ sheets: 0, cards: 0, notes: 0 });
    }
  };

  const runDelete = async (category: CategoryResponse, mode: 'plain' | 'move' | 'all') => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'move') await moveCategoryContent(category.id, moveTo);
      if (mode === 'all') await deleteCategoryContent(category.id);
      await onDelete(category.id);
      if (mode !== 'plain') await onContentChanged();
      setDeletingId(null);
    } catch (err) {
      console.error('Erreur lors de la suppression de la catégorie :', err);
      setError(err instanceof Error ? err.message : 'Impossible de supprimer la catégorie.');
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
      <div className="w-full max-w-lg rounded-3xl border border-amber-900/40 bg-[#1c1411] p-6 font-sans text-amber-50 shadow-2xl md:p-8">
        <div className="mb-5 flex items-center justify-between border-b border-amber-900/30 pb-3">
          <h2 className="font-serif text-xl font-bold text-amber-100">Gérer les catégories</h2>
          <button onClick={onClose} aria-label="Fermer" className="cursor-pointer font-serif text-xl text-amber-200/50 hover:text-amber-100">
            &times;
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-900/20 bg-neutral-900/50 p-4">
          <CategoryQuickAdd existing={categories} onCreate={onCreate} />
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {categories.length === 0 ? (
            <p className="py-4 text-center font-serif text-xs text-amber-200/40">Aucune catégorie enregistrée.</p>
          ) : (
            categories.map((category) => {
              const others = categories.filter((other) => other.id !== category.id);

              return (
                <div key={category.id} className="rounded-xl border border-amber-900/20 bg-neutral-900/80">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: category.color || '#b45309' }} />
                      <span className="truncate font-serif text-sm font-medium text-amber-100">{category.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => startEdit(category)}
                        className={`${ghostBtn} border-amber-800/40 bg-amber-950/60 text-amber-200 hover:bg-amber-900`}
                      >
                        Éditer
                      </button>
                      <button
                        onClick={() => void startDelete(category)}
                        className={`${ghostBtn} border-red-900/30 bg-red-950/50 text-red-300 hover:bg-red-900/80`}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {editingId === category.id && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveEdit(category);
                      }}
                      className="space-y-3 border-t border-amber-900/20 px-4 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={draft.color}
                          onChange={(event) => setDraft((d) => ({ ...d, color: event.target.value }))}
                          className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-amber-900/40 bg-neutral-900 p-1"
                          title="Couleur de l'onglet"
                        />
                        <input
                          type="text"
                          required
                          value={draft.name}
                          onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                          className="min-w-0 flex-1 rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2 font-serif text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block font-serif text-xs uppercase tracking-wider text-amber-200/60">
                          Cartes types d'une fiche (une par ligne)
                        </label>
                        <textarea
                          value={draft.template}
                          onChange={(event) => setDraft((d) => ({ ...d, template: event.target.value }))}
                          rows={4}
                          placeholder={'Apparence\nPersonnalité\nHistoire'}
                          className="w-full resize-none rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2 font-serif text-sm text-amber-100 placeholder-amber-200/20 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <p className="mt-1 text-[11px] text-amber-200/40">
                          Ces cartes sont créées d'un coup avec chaque nouvelle fiche de cette catégorie.
                        </p>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className={`${ghostBtn} border-transparent bg-neutral-800 text-amber-200/70 hover:bg-neutral-700`}
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={busy}
                          className={`${ghostBtn} border-amber-600 bg-amber-700 text-amber-50 hover:bg-amber-600`}
                        >
                          {busy ? 'En cours...' : 'Enregistrer'}
                        </button>
                      </div>
                    </form>
                  )}

                  {deletingId === category.id && (
                    <div className="space-y-3 border-t border-red-900/30 bg-red-950/10 px-4 py-4 text-sm">
                      {content === null ? (
                        <p className="text-amber-200/60">Vérification du contenu…</p>
                      ) : isEmpty(content) ? (
                        <p className="text-amber-100">
                          Supprimer la catégorie « {category.name} » ? Elle est vide.
                        </p>
                      ) : (
                        <>
                          <p className="text-amber-100">
                            « {category.name} » contient {describeContent(content)}. Que faire ?
                          </p>

                          {others.length > 0 && (
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <select
                                value={moveTo}
                                onChange={(event) => setMoveTo(Number(event.target.value))}
                                className="min-w-0 flex-1 cursor-pointer rounded-xl border border-amber-900/40 bg-neutral-900 px-3 py-2 font-serif text-sm text-amber-100 focus:outline-none"
                              >
                                <option value={0}>Déplacer vers…</option>
                                {others.map((other) => (
                                  <option key={other.id} value={other.id}>{other.name}</option>
                                ))}
                              </select>
                              <button
                                disabled={busy || moveTo === 0}
                                onClick={() => void runDelete(category, 'move')}
                                className={`${ghostBtn} border-amber-600 bg-amber-700 py-2 text-amber-50 hover:bg-amber-600`}
                              >
                                Déplacer et supprimer
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => setDeletingId(null)}
                          className={`${ghostBtn} border-transparent bg-neutral-800 text-amber-200/70 hover:bg-neutral-700`}
                        >
                          Annuler
                        </button>
                        {content !== null && (
                          <button
                            disabled={busy}
                            onClick={() => void runDelete(category, isEmpty(content) ? 'plain' : 'all')}
                            className={`${ghostBtn} border-red-800/60 bg-red-900/70 text-red-100 hover:bg-red-800`}
                          >
                            {busy ? 'En cours...' : isEmpty(content) ? 'Supprimer' : 'Tout supprimer'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-amber-900/30 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-amber-900/30 bg-neutral-900 px-5 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-neutral-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}