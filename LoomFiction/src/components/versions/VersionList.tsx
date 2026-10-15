import type { BaseVersion } from '../../hooks/useVersionCompare';
import { btnBase } from '../../utils/versionStyles';

interface Props<V extends BaseVersion> {
  versions: V[];
  selectedId: number | null;
  isRestoring: boolean;
  onView: (version: V) => void;
  onMerge: (version: V) => void;
  onDelete: (version: V) => void;
}

export function VersionList<V extends BaseVersion>({
  versions,
  selectedId,
  isRestoring,
  onView,
  onMerge,
  onDelete,
}: Props<V>) {
  const renderActions = (version: V, isSelected: boolean, className: string) => (
    <div className={className}>
      <button
        onClick={() => onView(version)}
        className={`${btnBase} px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border-amber-900/30 text-amber-200`}
      >
        Voir
      </button>
      <button
        onClick={() => onMerge(version)}
        disabled={isRestoring && isSelected}
        className={`${btnBase} px-3 py-2 bg-amber-700 hover:bg-amber-600 border-amber-700 text-amber-50 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {isRestoring && isSelected ? '...' : 'Fusionner'}
      </button>
      <button
        onClick={() => onDelete(version)}
        className={`${btnBase} px-3 py-2 bg-red-950/60 hover:bg-red-900/70 border-red-900/40 text-red-200`}
      >
        Supprimer
      </button>
    </div>
  );

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/55 shadow-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-amber-900/20">
        <h2 className="text-lg sm:text-xl font-bold text-amber-100">Versions</h2>
        <p className="text-xs sm:text-sm text-amber-200/50">
          {versions.length} résultat{versions.length > 1 ? 's' : ''}
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="px-5 py-10 text-center text-amber-200/60">Aucune version ne correspond à ce filtre.</div>
      ) : (
        <>
          {/* Mobile : cartes compactes, liste scrollable */}
          <ul className="md:hidden max-h-[42vh] overflow-y-auto divide-y divide-amber-900/10">
            {versions.map((version) => {
              const isSelected = selectedId === version.id;
              return (
                <li key={version.id} className={`p-3 space-y-2.5 ${isSelected ? 'bg-amber-950/40' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-800/40 bg-amber-950 text-amber-300 text-sm font-bold">
                      {version.versionNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-amber-100 truncate">{version.name}</div>
                      <div className="text-[11px] text-amber-200/40 truncate">
                        {isSelected ? 'Sélectionnée · ' : ''}ID {version.id} · {new Date(version.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {renderActions(version, isSelected, 'grid grid-cols-3 gap-2')}
                </li>
              );
            })}
          </ul>

          {/* Desktop : tableau pleine largeur */}
          <div className="hidden md:block max-h-[40vh] overflow-auto">
            <table className="min-w-full divide-y divide-amber-900/20">
              <thead className="bg-neutral-950/90 sticky top-0 z-10">
                <tr className="text-left text-xs uppercase tracking-[0.22em] text-amber-200/40">
                  <th className="px-5 py-3 font-medium">Version</th>
                  <th className="px-5 py-3 font-medium">Nom</th>
                  <th className="px-5 py-3 font-medium">Mise à jour</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-900/10">
                {versions.map((version) => {
                  const isSelected = selectedId === version.id;
                  return (
                    <tr key={version.id} className={`transition-colors ${isSelected ? 'bg-amber-950/40' : 'hover:bg-neutral-900/50'}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-800/40 bg-amber-950 text-amber-300 text-sm font-bold">
                            {version.versionNumber}
                          </span>
                          <div>
                            <div className="font-semibold text-amber-100">{isSelected ? 'Sélectionnée' : 'Disponible'}</div>
                            <div className="text-xs text-amber-200/40">ID {version.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-amber-100">{version.name}</td>
                      <td className="px-5 py-3 text-amber-200/70 text-sm whitespace-nowrap">{new Date(version.updatedAt).toLocaleString()}</td>
                      <td className="px-5 py-3">{renderActions(version, isSelected, 'flex flex-wrap gap-2')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}