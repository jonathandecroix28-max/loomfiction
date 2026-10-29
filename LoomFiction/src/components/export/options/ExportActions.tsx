import type { Status } from '../../../hooks/export/useExportActions';
import { StatusBanner } from '../StatusBanner';

type Props = {
  status: Status;
  busy: boolean;
  copying: boolean;
  progress: { done: number; total: number } | null;
  canAct: boolean;
  formatLabel?: string;
  showSelectHint: boolean;
  onExport: () => void;
  onCopy: () => void;
};

export function ExportActions({
  status,
  busy,
  copying,
  progress,
  canAct,
  formatLabel,
  showSelectHint,
  onExport,
  onCopy,
}: Props) {
  const disabled = busy || copying || !canAct;

  const exportLabel = busy
    ? progress && progress.total > 1
      ? `Préparation… ${progress.done}/${progress.total}`
      : 'Préparation…'
    : `Exporter en ${formatLabel}`;

  return (
    <section className="space-y-3">
      <StatusBanner status={status} />

      <button
        type="button"
        onClick={onExport}
        disabled={disabled}
        className="w-full px-4 py-3.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {exportLabel}
      </button>

      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-amber-900/30 text-amber-200 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {copying ? 'Copie…' : '📋 Copier le texte (pour le coller ailleurs)'}
      </button>

      {showSelectHint && (
        <p className="text-xs text-amber-200/50 text-center">Sélectionne au moins un chapitre.</p>
      )}
    </section>
  );
}