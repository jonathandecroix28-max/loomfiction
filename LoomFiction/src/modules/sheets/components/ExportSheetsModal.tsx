import { useMemo, useState } from 'react';
import type { CategoryResponse } from '../../../types/category';
import type { IdeaResponse } from '../../../types/idea';
import type { SheetResponse } from '../../../types/sheet';
import { exportSheetToJson, exportSheetToMarkdownFile } from '../services/sheetExchange';

type Format = 'json' | 'md';
type CategoryArg = Parameters<typeof exportSheetToJson>[1];

interface ExportSheetsModalProps {
  sheets: SheetResponse[];
  categories: CategoryResponse[];
  cardsBySheet: Map<number, IdeaResponse[]>;
  defaultSelectedIds: number[];
  onClose: () => void;
  onExported: (count: number) => void;
}

const FORMATS: { key: Format; label: string; hint: string }[] = [
  { key: 'json', label: '📄 JSON (.json)', hint: 'Ré-importable dans Plotweaver' },
  { key: 'md', label: '📝 Markdown (.md)', hint: 'Lisible partout, ré-importable' },
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const byOrder = (a: IdeaResponse, b: IdeaResponse) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export function ExportSheetsModal({
  sheets,
  categories,
  cardsBySheet,
  defaultSelectedIds,
  onClose,
  onExported,
}: ExportSheetsModalProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(defaultSelectedIds.filter((id) => sheets.some((sheet) => sheet.id === id)))
  );
  const [format, setFormat] = useState<Format>('json');
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const known = new Set(categories.map((category) => category.id));
    const list = categories.map((category) => ({
      key: String(category.id),
      label: category.name,
      color: category.color,
      sheets: sheets.filter((sheet) => sheet.categoryId === category.id),
    }));
    const orphans = sheets.filter((sheet) => !known.has(sheet.categoryId));
    if (orphans.length > 0) list.push({ key: 'none', label: 'Sans catégorie', color: '#a8a29e', sheets: orphans });
    return list.filter((group) => group.sheets.length > 0);
  }, [sheets, categories]);

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleGroup = (ids: number[]) =>
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });

  const handleExport = async () => {
    const chosen = sheets.filter((sheet) => selected.has(sheet.id));
    if (chosen.length === 0 || busy) return;

    setBusy(true);
    for (const [index, sheet] of chosen.entries()) {
      const category = (categories.find((c) => c.id === sheet.categoryId) ?? null) as CategoryArg;
      const cards = [...(cardsBySheet.get(sheet.id) ?? [])].sort(byOrder);

      if (format === 'json') exportSheetToJson(sheet, category, cards);
      else exportSheetToMarkdownFile(sheet, category, cards);

      // Laisse le navigateur enchaîner les téléchargements au lieu de les bloquer
      if (index < chosen.length - 1) await sleep(400);
    }
    setBusy(false);
    onExported(chosen.length);
    onClose();
  };

  const count = selected.size;

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
        aria-label="Exporter des fiches"
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-5 rounded-3xl border border-amber-900/40 bg-[#1c1411] p-6 font-sans text-amber-50 shadow-2xl md:p-8"
      >
        <h2 className="font-serif text-xl font-bold text-amber-100">💾 Exporter des fiches</h2>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-200/60">
              Fiches · {count}/{sheets.length}
            </span>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelected(new Set(sheets.map((sheet) => sheet.id)))}
                className="cursor-pointer text-amber-300 underline hover:text-amber-200"
              >
                Toutes
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="cursor-pointer text-amber-300 underline hover:text-amber-200"
              >
                Aucune
              </button>
            </div>
          </div>

          {groups.map((group) => {
            const ids = group.sheets.map((sheet) => sheet.id);
            return (
              <section key={group.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(ids)}
                  title="Cocher / décocher toute la catégorie"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left font-serif text-sm font-bold text-amber-200 hover:bg-neutral-900"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                  {group.label}
                </button>
                <ul className="rounded-xl border border-amber-900/20 divide-y divide-amber-900/10">
                  {group.sheets.map((sheet) => {
                    const total = cardsBySheet.get(sheet.id)?.length ?? 0;
                    return (
                      <li key={sheet.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-amber-100/90 hover:bg-neutral-900/50">
                          <input type="checkbox" checked={selected.has(sheet.id)} onChange={() => toggle(sheet.id)} />
                          <span className="min-w-0 flex-1 truncate">{sheet.name}</span>
                          <span className="shrink-0 text-xs text-amber-200/40">
                            {total} {total > 1 ? 'cartes' : 'carte'}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/60">Format</span>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFormat(item.key)}
                  aria-pressed={format === item.key}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition ${
                    format === item.key
                      ? 'border-amber-600 bg-amber-900/60 text-amber-50'
                      : 'border-amber-900/30 bg-neutral-900 text-amber-200 hover:border-amber-700/60'
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] text-amber-200/50">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {count > 1 && (
            <p className="text-xs text-amber-200/50">
              {count} fichiers seront téléchargés l'un après l'autre. Si ton navigateur le demande, autorise les
              téléchargements multiples.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-amber-900/30 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium text-amber-200/70 transition hover:bg-neutral-900 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={count === 0 || busy}
            className="cursor-pointer rounded-xl bg-amber-700 px-6 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Export...' : count > 1 ? `Exporter ${count} fiches` : 'Exporter'}
          </button>
        </div>
      </div>
    </div>
  );
}