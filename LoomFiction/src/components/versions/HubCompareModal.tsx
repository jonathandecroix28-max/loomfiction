import { useMemo, useState } from 'react';
import { IconCompare } from '../icons';
import { useVersionCompare } from '../../hooks/versions/useVersionCompare';
import { htmlToPlainText } from '../../utils/versions/sanitizeHtml';
import { ComparePanel, CompareCards } from './ComparePanel';
import { LineDiffView } from './LineDiffView';
import type { VersionRow } from '../versionsHubTypes';

export function HubCompareModal({
  parentTitle,
  versionA,
  versionB,
  onClose,
  onOpenVersion,
}: {
  parentTitle: string;
  versionA: VersionRow;
  versionB: VersionRow;
  onClose: () => void;
  onOpenVersion: (path: string) => void;
}) {
  const [hideEqualLines, setHideEqualLines] = useState(false);

  const [older, newer] =
    versionA.versionNumber <= versionB.versionNumber ? [versionA, versionB] : [versionB, versionA];

  const targetObj = useMemo(
    () => ({
      id: newer.versionId,
      versionNumber: newer.versionNumber,
      name: newer.versionName || `Version ${newer.versionNumber}`,
      updatedAt: newer.updatedAt,
      content: newer.rawTextContent,
    }),
    [newer]
  );

  const compare = useVersionCompare({
    versions: [targetObj],
    selectedVersion: targetObj,
    currentText: older.rawTextContent,
    getText: (item) => item.content,
    richText: older.isRichText,
  });

  const displayRows = hideEqualLines
    ? compare.rows.filter((row) => row.kind !== 'equal')
    : compare.rows;

  const renderBody = (body: string) =>
    htmlToPlainText(body) || 'Aucun contenu.';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-[#1c1411] border border-amber-700/40 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-amber-900/30 flex flex-wrap items-center justify-between gap-4 bg-neutral-950/90">
          <div>
            <span className="text-xs font-sans uppercase tracking-widest text-amber-400 font-semibold">
              Comparaison rapide · {parentTitle}
            </span>
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-amber-100 mt-0.5">
              v{older.versionNumber} {older.versionName ? `(${older.versionName})` : ''}{' '}
              <IconCompare className="mx-1 inline size-4 text-amber-500" aria-hidden="true" /> v{newer.versionNumber}{' '}
              {newer.versionName ? `(${newer.versionName})` : ''}
            </h3>
          </div>

          <div className="flex items-center gap-2 font-sans">
            {newer.openPath && (
              <button
                onClick={() => onOpenVersion(newer.openPath!)}
                className="bg-amber-700 hover:bg-amber-600 text-amber-50 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer"
              >
                Ouvrir v{newer.versionNumber} en pleine page
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-neutral-900 hover:bg-neutral-800 text-amber-200 px-4 py-2 rounded-xl text-xs sm:text-sm border border-amber-900/30 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          <ComparePanel
            mode={compare.compareMode}
            onModeChange={compare.setCompareMode}
            currentLeftLabel={`v${older.versionNumber} à gauche`}
          >
            <CompareCards
              mode={compare.compareMode}
              current={{
                label: `Version v${older.versionNumber}`,
                name: older.versionName || `Version ${older.versionNumber}`,
                body: older.rawTextContent,
              }}
              version={{
                label: `Version v${newer.versionNumber}`,
                name: newer.versionName || `Version ${newer.versionNumber}`,
                body: newer.rawTextContent,
              }}
              renderBody={renderBody}
              bodyClassName="max-h-64 md:max-h-80 overflow-y-auto max-w-none whitespace-pre-wrap leading-relaxed wrap-break-word text-amber-100/90 font-serif text-sm sm:text-base"
            />

            <div className="border-t border-amber-900/30 pt-5 flex flex-col gap-4">
              <div className="flex items-center justify-between font-sans">
                <span className="text-xs uppercase tracking-widest text-amber-200/50 font-semibold">
                  Différences ligne par ligne
                </span>
                <label className="flex items-center gap-2 text-xs sm:text-sm text-amber-200/80 cursor-pointer hover:text-amber-100">
                  <input
                    type="checkbox"
                    checked={hideEqualLines}
                    onChange={(e) => setHideEqualLines(e.target.checked)}
                    className="rounded border-amber-900/50 bg-neutral-900 text-amber-600 w-4 h-4 cursor-pointer"
                  />
                  Masquer les lignes identiques
                </label>
              </div>

              <LineDiffView
                rows={displayRows}
                choices={compare.choices}
                onChoose={compare.choose}
                help="Aperçu des ajouts et suppressions entre les deux versions."
                emptyMessage={
                  hideEqualLines
                    ? 'Aucune différence trouvée (toutes les lignes identiques sont masquées).'
                    : 'Aucun contenu à comparer.'
                }
              />
            </div>
          </ComparePanel>
        </div>
      </div>
    </div>
  );
}