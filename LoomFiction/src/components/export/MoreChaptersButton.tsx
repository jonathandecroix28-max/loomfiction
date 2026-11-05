import { PREVIEW_STEP } from '../../hooks/export/useExportPreview';
import { plural } from '../../utils/export/text';
import { smallBtn } from '../../utils/export/ui';

export function MoreChaptersButton({ hidden, onClick }: { hidden: number; onClick: () => void }) {
  if (hidden <= 0) return null;
  const next = Math.min(PREVIEW_STEP, hidden);
  return (
    <button type="button" onClick={onClick} className={`${smallBtn} w-full py-2.5`}>
      Afficher {next} {plural(next, 'chapitre')} de plus
      <span className="text-amber-200/40"> ({hidden} {plural(hidden, 'masqué')} dans l’aperçu)</span>
    </button>
  );
}