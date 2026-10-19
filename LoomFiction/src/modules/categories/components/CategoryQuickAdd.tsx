import { useState } from 'react';
import type { CategoryResponse, CategoryUpsertRequest } from '../../../types/category';
import { CATEGORY_PRESETS, nameKey, nextColor, presetFor } from '../categoryPresets';

interface CategoryQuickAddProps {
  existing: CategoryResponse[];
  onCreate: (data: CategoryUpsertRequest) => Promise<unknown>;
  onDone?: () => void;
  autoFocus?: boolean;
}

export function CategoryQuickAdd({ existing, onCreate, onDone, autoFocus = false }: CategoryQuickAddProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const taken = new Set(existing.map((category) => nameKey(category.name)));
  const suggestions = CATEGORY_PRESETS.filter((preset) => !taken.has(nameKey(preset.name)));

  const create = async (rawName: string) => {
    const clean = rawName.trim();
    if (!clean || busy) return;
    if (taken.has(nameKey(clean))) {
      setError('Cette catégorie existe déjà.');
      return;
    }

    // Un nom connu (Personnage, Lieu…) reprend sa couleur et ses cartes types
    const preset = presetFor(clean);

    setBusy(true);
    setError('');
    try {
      await onCreate({
        name: clean,
        color: preset?.color ?? nextColor(existing.map((category) => category.color)),
        template: preset?.template,
      });
      setName('');
      onDone?.();
    } catch (err) {
      console.error('Erreur lors de la création de la catégorie :', err);
      setError('Impossible de créer la catégorie.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 font-sans">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create(name);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={name}
          autoFocus={autoFocus}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
          placeholder="Nom de la catégorie (ex. Personnage)"
          className="min-w-0 flex-1 rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2.5 font-serif text-sm text-amber-100 placeholder-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="shrink-0 cursor-pointer rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Ajouter
        </button>
      </form>

      {error && <p className="text-xs text-red-300">{error}</p>}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-serif text-xs text-amber-200/40">Suggestions :</span>
          {suggestions.map((preset) => (
            <button
              key={preset.name}
              type="button"
              disabled={busy}
              onClick={() => void create(preset.name)}
              title={preset.template ? `Avec un modèle de fiche : ${preset.template.join(', ')}` : 'Notes libres'}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-900/40 bg-neutral-900 px-3 py-1.5 text-xs text-amber-200 transition hover:border-amber-600/60 disabled:opacity-50"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: preset.color }} />
              {preset.name}
              {preset.template && <span aria-hidden="true">🗂️</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}