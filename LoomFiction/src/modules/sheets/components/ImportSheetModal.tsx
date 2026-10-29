import { useState, type ChangeEvent } from 'react';
import type { CategoryResponse } from '../../../types/category';
import type { SheetResponse } from '../../../types/sheet';
import { parseSheetContent, createSheetFromImport } from '../services/sheetExchange';

export const MAX_IMPORT_FILES = 5;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type ParsedSheet = ReturnType<typeof parseSheetContent>;

type Entry = {
  key: string;
  fileName: string;
  parsed: ParsedSheet | null;
  error: string | null;
  status: 'ready' | 'importing' | 'done' | 'failed';
};

interface ImportSheetModalProps {
  categories: CategoryResponse[];
  defaultCategoryId?: number | null;
  onClose: () => void;
  onImported: (sheets: SheetResponse[], result: { failed: number }) => void | Promise<void>;
}

const fileKey = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;

async function readEntry(file: File): Promise<Entry> {
  const base = { key: fileKey(file), fileName: file.name, status: 'ready' as const };

  if (file.size > MAX_FILE_BYTES) {
    return { ...base, parsed: null, error: 'Fichier trop volumineux (2 Mo maximum).' };
  }
  try {
    return { ...base, parsed: parseSheetContent(await file.text()), error: null };
  } catch {
    return { ...base, parsed: null, error: 'Impossible de lire la structure du fichier.' };
  }
}

const STATUS_LABEL: Record<Entry['status'], { text: string; className: string } | null> = {
  ready: null,
  importing: { text: 'Importation…', className: 'text-amber-300 animate-pulse' },
  done: { text: '✓ Importée', className: 'text-emerald-300' },
  failed: { text: 'Échec de l’import', className: 'text-red-300' },
};

/** Importe jusqu'à 5 fiches à la fois, toutes dans la même catégorie. À afficher seulement quand elle est ouverte. */
export function ImportSheetModal({ categories, defaultCategoryId, onClose, onImported }: ImportSheetModalProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const categoryId =
    [selectedCategoryId, defaultCategoryId].find(
      (id): id is number => id != null && categories.some((category) => category.id === id)
    ) ??
    categories[0]?.id ??
    null;

  const patchEntry = (key: string, patch: Partial<Entry>) =>
    setEntries((list) => list.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)));

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ''; 
    if (picked.length === 0) return;

    const known = new Set(entries.map((entry) => entry.key));
    const fresh = picked.filter((file, index) => {
      const key = fileKey(file);
      return !known.has(key) && picked.findIndex((other) => fileKey(other) === key) === index;
    });
    const accepted = fresh.slice(0, MAX_IMPORT_FILES - entries.length);
    const overLimit = fresh.length - accepted.length;

    if (overLimit > 0) {
      setNotice(`${MAX_IMPORT_FILES} fichiers maximum : ${overLimit} fichier${overLimit > 1 ? 's' : ''} ignoré${overLimit > 1 ? 's' : ''}.`);
    } else if (fresh.length < picked.length) {
      setNotice('Ce fichier est déjà dans la liste.');
    } else {
      setNotice('');
    }

    const read = await Promise.all(accepted.map(readEntry));
    setEntries((list) => [...list, ...read.filter((entry) => !list.some((other) => other.key === entry.key))]);
  };

  const importable = entries.filter((entry) => entry.parsed && entry.status !== 'done');
  const doneCount = entries.filter((entry) => entry.status === 'done').length;
  const canPickMore = entries.length < MAX_IMPORT_FILES && !busy;

  const handleImport = async () => {
    if (importable.length === 0 || categoryId == null || busy) return;

    setBusy(true);
    setNotice('');

    const created: SheetResponse[] = [];
    for (const entry of importable) {
      patchEntry(entry.key, { status: 'importing' });
      try {
        created.push(await createSheetFromImport(entry.parsed!, categoryId));
        patchEntry(entry.key, { status: 'done' });
      } catch (err) {
        console.error(`Erreur lors de l’importation de « ${entry.fileName} » :`, err);
        patchEntry(entry.key, { status: 'failed' });
      }
    }

    setBusy(false);
    const failed = importable.length - created.length;
    if (created.length > 0) await onImported(created, { failed });
    if (failed === 0) onClose();
  };

  const importLabel = busy
    ? 'Importation...'
    : importable.length > 1
      ? `Importer ${importable.length} fiches`
      : 'Importer';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importer des fiches"
        className="max-h-[90dvh] w-full max-w-md space-y-5 overflow-y-auto rounded-3xl border border-amber-900/40 bg-[#1c1411] p-6 font-sans text-amber-50 shadow-2xl md:p-8"
      >
        <h2 className="font-serif text-xl font-bold text-amber-100">📥 Importer des fiches</h2>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
            Fichiers d'import (.json ou .md) · {entries.length}/{MAX_IMPORT_FILES}
          </label>
          <input
            type="file"
            multiple
            accept=".json,.md,.txt"
            disabled={!canPickMore}
            onChange={(e) => void handleFiles(e)}
            className="w-full text-sm text-amber-200/80 file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-amber-700 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-amber-50 hover:file:bg-amber-600 disabled:opacity-50 disabled:file:cursor-not-allowed"
          />
          <p className="mt-2 text-xs text-amber-200/40">Sélectionne jusqu'à {MAX_IMPORT_FILES} fichiers en une fois.</p>
          {notice && <p role="status" className="mt-2 text-xs text-amber-300">{notice}</p>}
        </div>

        {entries.length > 0 && (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const status = STATUS_LABEL[entry.status];
              return (
                <li
                  key={entry.key}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    entry.error ? 'border-red-900/40 bg-red-950/20' : 'border-amber-900/30 bg-neutral-900/60'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate font-serif font-bold text-amber-100">{entry.parsed?.name ?? entry.fileName}</p>
                    {entry.error ? (
                      <p className="text-xs text-red-300">{entry.fileName} · {entry.error}</p>
                    ) : (
                      <p className="truncate text-xs text-amber-200/60">
                        {entry.fileName} · {entry.parsed!.cards.length}{' '}
                        {entry.parsed!.cards.length > 1 ? 'caractéristiques' : 'caractéristique'}
                      </p>
                    )}
                    {status && <p className={`text-xs font-medium ${status.className}`}>{status.text}</p>}
                  </div>

                  {!busy && entry.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => setEntries((list) => list.filter((other) => other.key !== entry.key))}
                      aria-label={`Retirer ${entry.fileName}`}
                      className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-amber-200/50 transition hover:bg-neutral-800 hover:text-amber-100"
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
            Catégorie de destination
          </label>
          {categories.length === 0 ? (
            <p className="text-sm text-amber-300">Crée d'abord une catégorie pour pouvoir importer.</p>
          ) : (
            <select
              value={categoryId ?? ''}
              disabled={busy}
              onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
              className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2.5 font-serif text-sm text-amber-100 focus:outline-none"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-amber-900/30 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium text-amber-200/70 transition hover:bg-neutral-900 disabled:opacity-50"
          >
            {doneCount > 0 ? 'Fermer' : 'Annuler'}
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importable.length === 0 || categoryId == null || busy}
            className="cursor-pointer rounded-xl bg-amber-700 px-6 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importLabel}
          </button>
        </div>
      </div>
    </div>
  );
}