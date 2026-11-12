import { useMemo, useState, type ReactNode } from 'react';
import { IconChevronRight, IconDelete } from '../icons';
import type { VersionRow, FolderGroup } from '../versionsHubTypes';

type VersionsSectionProps = {
  title: string;
  subtitle: string;
  tag: string;
  emptyLabel: string;
  contextLabel: string;
  rows: VersionRow[];
  renderContext: (row: VersionRow) => ReactNode;
  onOpen: (path: string) => void;
  onDelete: (row: VersionRow) => void;
  onComparePair: (parentTitle: string, versionA: VersionRow, versionB: VersionRow) => void;
};

export function VersionsSection({
  title,
  subtitle,
  tag,
  emptyLabel,
  contextLabel,
  rows,
  renderContext,
  onOpen,
  onDelete,
  onComparePair,
}: VersionsSectionProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [selectedCompare, setSelectedCompare] = useState<{
    parentKey: string | null;
    selected: VersionRow[];
  }>({ parentKey: null, selected: [] });

  const folders = useMemo<FolderGroup[]>(() => {
    const map = new Map<string, FolderGroup>();

    for (const row of rows) {
      let group = map.get(row.parentKey);
      if (!group) {
        group = {
          parentKey: row.parentKey,
          parentTitle: row.parentTitle,
          missing: row.missing,
          kind: row.kind,
          latestUpdatedAt: row.updatedAt,
          parentEditorPath: row.parentEditorPath,
          sampleRow: row,
          versions: [],
        };
        map.set(row.parentKey, group);
      }
      group.versions.push(row);
      if (new Date(row.updatedAt).getTime() > new Date(group.latestUpdatedAt).getTime()) {
        group.latestUpdatedAt = row.updatedAt;
      }
    }

    const result = Array.from(map.values());
    for (const g of result) {
      g.versions.sort((a, b) => b.versionNumber - a.versionNumber);
    }
    result.sort((a, b) => new Date(b.latestUpdatedAt).getTime() - new Date(a.latestUpdatedAt).getTime());
    return result;
  }, [rows]);

  const totalPages = Math.ceil(folders.length / pageSize);

  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setPage(1);
  }

  const paginatedFolders = folders.slice((page - 1) * pageSize, page * pageSize);

  const toggleFolder = (parentKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [parentKey]: !prev[parentKey],
    }));
  };

  const toggleSelectVersion = (folder: FolderGroup, version: VersionRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCompare((prev) => {
      if (prev.parentKey !== folder.parentKey) {
        return { parentKey: folder.parentKey, selected: [version] };
      }
      const exists = prev.selected.some((v) => v.key === version.key);
      if (exists) {
        const next = prev.selected.filter((v) => v.key !== version.key);
        return { parentKey: next.length > 0 ? folder.parentKey : null, selected: next };
      }
      if (prev.selected.length >= 2) {
        return { parentKey: folder.parentKey, selected: [prev.selected[1], version] };
      }
      return { parentKey: folder.parentKey, selected: [...prev.selected, version] };
    });
  };

  const versionActionButtons = (row: VersionRow) => (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => row.openPath && onOpen(row.openPath)}
        disabled={!row.openPath}
        className="px-2.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-[10px] sm:text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {row.openPath ? 'Ouvrir' : 'N/A'}
      </button>
      <button
        onClick={() => onDelete(row)}
        className="px-2 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/80 text-red-400 border border-red-900/30 text-[10px] sm:text-xs transition-colors cursor-pointer"
        title="Supprimer cette version"
        aria-label="Supprimer cette version"
      >
        <IconDelete className="size-3.5 sm:size-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/55 shadow-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-amber-900/20 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-amber-100">{title}</h2>
            <span className="rounded-full bg-amber-950 border border-amber-800/40 px-2.5 py-0.5 text-[11px] font-sans font-semibold text-amber-300">
              {folders.length} {folders.length > 1 ? 'dossiers' : 'dossier'} · {rows.length}{' '}
              {rows.length > 1 ? 'versions' : 'version'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-amber-200/50">{subtitle}</p>
        </div>
        <div className="hidden sm:block text-xs text-amber-200/40 uppercase tracking-[0.22em] shrink-0">{tag}</div>
      </div>

      {folders.length === 0 ? (
        <div className="px-5 py-10 text-center text-amber-200/60">{emptyLabel}</div>
      ) : (
        <>
          <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto_auto] gap-4 px-5 py-3 bg-neutral-950/80 border-b border-amber-900/20 text-xs uppercase tracking-[0.22em] text-amber-200/40 font-medium">
            <div>Dossier ({contextLabel.split('/')[0].trim()})</div>
            <div>{contextLabel}</div>
            <div>Versions</div>
            <div>Dernière activité</div>
            <div className="text-right">Actions</div>
          </div>

          <div className="divide-y divide-amber-900/15">
            {paginatedFolders.map((folder) => {
              const isOpen = !!expandedFolders[folder.parentKey];
              const isFolderComparing = selectedCompare.parentKey === folder.parentKey;
              const selectedCount = isFolderComparing ? selectedCompare.selected.length : 0;

              return (
                <div
                  key={folder.parentKey}
                  className={`transition-colors ${isOpen ? 'bg-neutral-900/35' : 'hover:bg-neutral-900/40'}`}
                >
                  <div
                    onClick={() => toggleFolder(folder.parentKey)}
                    className="px-3.5 sm:px-5 py-3.5 sm:py-4 flex flex-col md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto_auto] md:items-center gap-2.5 md:gap-4 cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconChevronRight
                        className={`size-4 shrink-0 text-amber-400/80 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-amber-100 group-hover:text-amber-300 transition-colors truncate text-sm sm:text-base">
                          {folder.parentTitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pl-6 md:pl-0 min-w-0">
                      {renderContext(folder.sampleRow)}
                    </div>

                    <div className="pl-6 md:pl-0 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-800/40 bg-amber-950/90 px-2.5 py-0.5 text-[11px] font-sans font-semibold text-amber-300 whitespace-nowrap">
                        {folder.versions.length} {folder.versions.length > 1 ? 'versions' : 'version'}
                      </span>
                    </div>

                    <div className="pl-6 md:pl-0 text-amber-200/60 text-xs sm:text-sm whitespace-nowrap">
                      {new Date(folder.latestUpdatedAt).toLocaleDateString()}
                    </div>

                    <div
                      className="pl-6 md:pl-0 flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isFolderComparing && selectedCount === 2 && (
                        <button
                          onClick={() =>
                            onComparePair(
                              folder.parentTitle,
                              selectedCompare.selected[0],
                              selectedCompare.selected[1]
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-sans font-semibold shadow-md transition cursor-pointer whitespace-nowrap"
                        >
                          Comparer (2)
                        </button>
                      )}

                      {folder.parentEditorPath && (
                        <button
                          onClick={() => onOpen(folder.parentEditorPath!)}
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-200/80 border border-amber-900/30 text-[11px] sm:text-xs font-sans transition cursor-pointer whitespace-nowrap"
                        >
                          Élément
                        </button>
                      )}

                      <button
                        onClick={() => toggleFolder(folder.parentKey)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-800/30 text-[11px] sm:text-xs font-sans transition cursor-pointer whitespace-nowrap"
                      >
                        {isOpen ? 'Fermer' : 'Versions'}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="bg-black/40 border-t border-amber-900/20 px-3.5 sm:px-6 py-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <span className="text-[11px] font-sans uppercase tracking-wider text-amber-200/50">
                          {folder.versions.length >= 2
                            ? 'Cochez 2 versions pour les comparer directement'
                            : '1 seule version archivée dans ce dossier'}
                        </span>

                        {isFolderComparing && selectedCount > 0 && (
                          <div className="flex items-center gap-3 font-sans">
                            <span className="text-xs text-amber-300">
                              {selectedCount}/2 sélectionnée{selectedCount > 1 ? 's' : ''}
                            </span>
                            {selectedCount === 2 && (
                              <button
                                onClick={() =>
                                  onComparePair(
                                    folder.parentTitle,
                                    selectedCompare.selected[0],
                                    selectedCompare.selected[1]
                                  )
                                }
                                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                              >
                                Lancer le comparatif
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedCompare({ parentKey: null, selected: [] })}
                              className="text-xs text-amber-200/60 hover:text-amber-100 underline cursor-pointer"
                            >
                              Effacer
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 border-l-2 border-amber-800/40 pl-3 sm:pl-4 ml-1.5">
                        {folder.versions.map((ver, idx) => {
                          const isChecked =
                            isFolderComparing &&
                            selectedCompare.selected.some((s) => s.key === ver.key);
                          const previousVer = folder.versions[idx + 1];

                          return (
                            <div
                              key={ver.key}
                              onClick={(e) =>
                                folder.versions.length >= 2 && toggleSelectVersion(folder, ver, e)
                              }
                              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl border transition-all ${
                                folder.versions.length >= 2 ? 'cursor-pointer' : ''
                              } ${
                                isChecked
                                  ? 'bg-amber-900/30 border-amber-500/70'
                                  : 'bg-neutral-900/70 border-amber-900/20 hover:border-amber-700/40'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                {folder.versions.length >= 2 && (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="accent-amber-500 w-4 h-4 rounded cursor-pointer shrink-0"
                                  />
                                )}

                                <span className="inline-flex h-7 min-w-7 px-1.5 items-center justify-center rounded-full border border-amber-800/40 bg-amber-950 text-amber-300 text-xs font-bold shrink-0">
                                  v{ver.versionNumber}
                                </span>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-amber-100 text-xs sm:text-sm truncate">
                                      {ver.versionName || `Version ${ver.versionNumber}`}
                                    </span>
                                    {idx === 0 && (
                                      <span className="text-[10px] font-sans bg-emerald-950 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded-full shrink-0">
                                        Dernière
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-amber-200/50">
                                    {new Date(ver.updatedAt).toLocaleString()}
                                    {ver.kind === 'sheet' && ver.cardCount != null && (
                                      <span> · {ver.cardCount} carte{ver.cardCount > 1 ? 's' : ''}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center">
                                {previousVer && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onComparePair(folder.parentTitle, previousVer, ver);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-950/90 hover:bg-amber-800 text-amber-200 border border-amber-800/40 text-[10px] sm:text-xs font-sans transition cursor-pointer whitespace-nowrap"
                                    title={`Comparer v${previousVer.versionNumber} avec v${ver.versionNumber}`}
                                  >
                                    Diff vs v{previousVer.versionNumber}
                                  </button>
                                )}

                                {versionActionButtons(ver)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-amber-900/20 flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-amber-200/50">
                Page {page}/{totalPages} ({folders.length} dossiers · {rows.length} versions)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-200/80 text-[10px] sm:text-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-200/80 text-[10px] sm:text-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}