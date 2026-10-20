import { useState, type ChangeEvent } from 'react';
import type { CategoryResponse } from '../../../types/category';
import type { SheetResponse } from '../../../types/sheet';
import { parseSheetContent, createSheetFromImport } from '../services/sheetExchange';

interface ImportSheetModalProps {
  isOpen: boolean;
  categories: CategoryResponse[];
  defaultCategoryId?: number | null;
  onClose: () => void;
  onImported: (sheet: SheetResponse) => void;
}

export function ImportSheetModal({
  isOpen,
  categories,
  defaultCategoryId,
  onClose,
  onImported,
}: ImportSheetModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(
    defaultCategoryId || (categories[0]?.id ?? 0)
  );
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<{ name: string; cardCount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      try {
        const parsed = parseSheetContent(text);
        setPreview({ name: parsed.name, cardCount: parsed.cards.length });
      } catch {
        setError('Impossible de lire la structure du fichier.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!fileContent || !selectedCategoryId || busy) return;

    setBusy(true);
    setError('');
    try {
      const parsed = parseSheetContent(fileContent);
      const createdSheet = await createSheetFromImport(parsed, selectedCategoryId);
      onImported(createdSheet);
      onClose();
    } catch (err) {
      console.error('Erreur lors de l’importation de la fiche :', err);
      setError('Impossible d’importer cette fiche.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-amber-900/40 bg-[#1c1411] p-6 font-sans text-amber-50 shadow-2xl md:p-8">
        <h2 className="font-serif text-xl font-bold text-amber-100">📥 Importer une fiche</h2>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
            Fichier d'import (.json ou .md)
          </label>
          <input
            type="file"
            accept=".json,.md,.txt"
            onChange={handleFileChange}
            className="w-full text-sm text-amber-200/80 file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-amber-700 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-amber-50 hover:file:bg-amber-600"
          />
        </div>

        {preview && (
          <div className="rounded-xl border border-amber-900/30 bg-neutral-900/60 p-4 space-y-1">
            <p className="font-serif font-bold text-amber-100">{preview.name}</p>
            <p className="text-xs text-amber-200/60">
              {fileName} · {preview.cardCount} {preview.cardCount > 1 ? 'caractéristiques trouvées' : 'caractéristique trouvée'}
            </p>
          </div>
        )}

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">
            Catégorie de destination
          </label>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
            className="w-full rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2.5 font-serif text-sm text-amber-100 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

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
            onClick={() => void handleImport()}
            disabled={!fileContent || !selectedCategoryId || busy}
            className="cursor-pointer rounded-xl bg-amber-700 px-6 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:opacity-50"
          >
            {busy ? 'Importation...' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}