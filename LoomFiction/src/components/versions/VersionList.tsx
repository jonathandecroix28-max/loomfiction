import type { BaseVersion } from '../../hooks/versions/useVersionCompare';
import { IconDelete } from '../icons';
import '../diff/diff.css';

interface Props<V extends BaseVersion> {
  versions: V[];
  selectedId: number | null;
  onView: (version: V) => void;
  onDelete: (version: V) => void;
}


export function VersionList<V extends BaseVersion>({ versions, selectedId, onView, onDelete }: Props<V>) {
  return (
    <section className="loom overflow-hidden rounded-2xl border border-amber-900/25 bg-neutral-950/55 shadow-xl sm:rounded-3xl">
      <div className="border-b border-amber-900/20 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-bold text-amber-100 sm:text-xl">Versions</h2>
          <p className="font-sans text-xs text-amber-200/50 sm:text-sm">
            {versions.length} résultat{versions.length > 1 ? 's' : ''}
          </p>
        </div>
        <p className="mt-1 font-sans text-xs text-amber-200/60 sm:text-sm">
          Clique sur « Comparer » pour voir ce qui a changé par rapport à la version actuelle.
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="px-5 py-10 text-center text-amber-200/60">Aucune version ne correspond à ce filtre.</div>
      ) : (
        <ol className="ld-log max-h-[46vh] overflow-y-auto">
          {versions.map((version) => {
            const isSelected = selectedId === version.id;
            const updated = new Date(version.updatedAt);
            return (
              <li key={version.id} className="ld-vrow" data-selected={isSelected}>
                <span className="ld-vknot" title={`Version ${version.versionNumber}`}>
                  {version.versionNumber}
                </span>

                <div className="min-w-0 flex-1 basis-40">
                  <div className="truncate font-semibold text-amber-100">{version.name}</div>
                  <div className="truncate font-sans text-[11px] text-amber-200/45 sm:text-xs">
                    <span className="sm:hidden">{updated.toLocaleDateString()}</span>
                    <span className="hidden sm:inline">{updated.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-sans">
                  {isSelected ? (
                    <span className="ld-pill ld-pill-mod">✓ Comparaison affichée</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onView(version)}
                      className="touch-target cursor-pointer rounded-lg border border-amber-700 bg-amber-700 px-4 py-2 text-xs font-medium text-amber-50 transition hover:bg-amber-600 sm:min-h-0"
                    >
                      Comparer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(version)}
                    title="Supprimer cette version"
                    aria-label={`Supprimer la version ${version.versionNumber}`}
                    className="touch-target flex size-10 cursor-pointer items-center justify-center rounded-lg border border-amber-900/30 text-amber-200/60 transition hover:border-red-900/50 hover:bg-red-950/50 hover:text-red-300 sm:size-9 sm:min-h-0"
                  >
                    <IconDelete className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}