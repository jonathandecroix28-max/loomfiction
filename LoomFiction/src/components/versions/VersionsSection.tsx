import { useMemo, useState, type ReactNode } from 'react';
import { IconChevronRight, IconDelete, IconCompare } from '../icons';
import type { VersionRow, FolderGroup } from '../versionsHubTypes';
import { htmlToPlainText } from '../../utils/versions/sanitizeHtml';
import { formatDate } from '../../utils/date/dateFormatter';

type VersionsSectionProps = {
  title: string;
  subtitle: string;
  tag: string;
  emptyLabel: string;
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
  rows,
  renderContext,
  onOpen,
  onDelete,
  onComparePair,
}: VersionsSectionProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  
  const [selectedCompare, setSelectedCompare] = useState<{
    parentKey: string | null;
    parentTitle: string | null;
    selected: VersionRow[];
  }>({ parentKey: null, parentTitle: null, selected: [] });

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
        return { parentKey: folder.parentKey, parentTitle: folder.parentTitle, selected: [version] };
      }
      const exists = prev.selected.some((v) => v.key === version.key);
      if (exists) {
        const next = prev.selected.filter((v) => v.key !== version.key);
        return { parentKey: next.length > 0 ? folder.parentKey : null, parentTitle: next.length > 0 ? folder.parentTitle : null, selected: next };
      }
      if (prev.selected.length >= 2) {
        return { parentKey: folder.parentKey, parentTitle: folder.parentTitle, selected: [prev.selected[1], version] };
      }
      return { parentKey: folder.parentKey, parentTitle: folder.parentTitle, selected: [...prev.selected, version] };
    });
  };

  const expandAll = () => {
    const allIds = folders.reduce((acc, folder) => ({ ...acc, [folder.parentKey]: true }), {});
    setExpandedFolders(allIds);
  };

  const collapseAll = () => {
    setExpandedFolders({});
  };

  return (
    <section className="space-y-4">
      {/* En-tête de la section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-amber-200/40">
            {tag}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-amber-100">{title}</h2>
          <p className="mt-1 text-sm text-amber-200/55">{subtitle}</p>
        </div>
        {folders.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="px-2 sm:px-3 py-2 rounded border border-amber-900/30 bg-neutral-900 text-amber-200 text-xs sm:text-sm font-medium transition cursor-pointer hover:bg-neutral-800"
            >
              Tout déplier
            </button>
            <button
              onClick={collapseAll}
              className="px-2 sm:px-3 py-2 rounded border border-amber-900/30 bg-neutral-900 text-amber-200 text-xs sm:text-sm font-medium transition cursor-pointer hover:bg-neutral-800"
            >
              Tout replier
            </button>
          </div>
        )}
      </div>

      {folders.length === 0 ? (
        <div className="rounded-2xl border border-amber-900/25 bg-neutral-950/55 px-4 py-8 text-center text-sm text-amber-200/50">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {folders.map((folder, index) => {
            const isOpen = !!expandedFolders[folder.parentKey];
            const isFolderComparing = selectedCompare.parentKey === folder.parentKey;
            
            return (
              <div
                key={folder.parentKey}
                className={`bg-neutral-950/70 border transition-all rounded-2xl overflow-hidden ${
                  isOpen
                    ? 'border-amber-600/50 shadow-lg'
                    : 'border-amber-900/20 hover:border-amber-700/40 shadow-md'
                }`}
              >
                {/* Dossier (Header de l'accordéon) */}
                <div
                  onClick={() => toggleFolder(folder.parentKey)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer group select-none"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <IconChevronRight
                      className={`size-4 shrink-0 text-amber-400/80 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />

                    {/* Pastille visuelle gauche (numéro de dossier ou icône) */}
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center font-serif font-bold text-base transition-colors shrink-0 ${
                        isOpen
                          ? 'bg-amber-700 text-amber-50 border-amber-500'
                          : 'bg-amber-950 group-hover:bg-amber-800 text-amber-300 border-amber-800/40'
                      }`}
                    >
                      {folder.kind === 'chapter' ? folder.sampleRow.chapterNumber ?? (index + 1) : (folder.kind === 'idea' ? 'I' : 'F')}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif font-bold text-amber-100 text-lg group-hover:text-amber-300 transition-colors truncate">
                          {folder.parentTitle}
                        </h3>
                        <span className="text-[11px] bg-amber-950/90 text-amber-300/90 border border-amber-800/40 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                          {folder.versions.length} {folder.versions.length > 1 ? 'versions archivées' : 'version archivée'}
                        </span>
                      </div>
                      
                      {/* Ligne 2 : Pastilles de contexte & Date de dernière modification */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          {renderContext(folder.sampleRow)}
                        </div>
                        <p className="text-xs text-amber-200/40 font-serif italic">
                          · Modifié le {formatDate(folder.latestUpdatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                    {folder.parentEditorPath && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(folder.parentEditorPath!);
                        }}
                        className="text-xs bg-neutral-900 hover:bg-neutral-800 text-amber-200 border border-amber-900/30 px-3.5 py-2 rounded-lg transition font-sans font-medium cursor-pointer"
                      >
                        Éditer
                      </button>
                    )}
                  </div>
                </div>

                {/* Contenu du dossier : Liste des versions */}
                {isOpen && (
                  <div className="bg-neutral-950/50 border-t border-amber-900/20 px-4 sm:px-6 py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-widest text-amber-200/50 font-semibold">
                        {folder.versions.length >= 2 ? 'Cochez 2 éléments pour les comparer' : 'Version unique archivée.'}
                      </span>
                    </div>

                    <div className="space-y-2 border-l-2 border-amber-800/40 pl-3 sm:pl-4 ml-1.5">
                      {folder.versions.map((version) => {
                        const isSelected =
                          isFolderComparing && selectedCompare.selected.some((s) => s.key === version.key);
                        
                        const words = htmlToPlainText(version.rawTextContent ?? '').split(/\s+/).filter(Boolean).length;

                        return (
                          <div
                            key={version.key}
                            onClick={(e) => folder.versions.length >= 2 && toggleSelectVersion(folder, version, e)}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all ${folder.versions.length >= 2 ? 'cursor-pointer' : ''} ${
                              isSelected
                                ? 'bg-amber-900/30 border-amber-500/70'
                                : 'bg-neutral-900/50 border-amber-900/20 hover:border-amber-700/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {folder.versions.length >= 2 && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="accent-amber-500 w-4 h-4 rounded cursor-pointer shrink-0"
                                />
                              )}
                              
                              <span className="inline-flex h-7 min-w-7 px-1.5 items-center justify-center rounded-full border border-amber-800/40 bg-amber-950 text-amber-300 text-xs font-bold shrink-0">
                                v{version.versionNumber}
                              </span>
                              
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-amber-100 truncate">
                                  {version.versionName || `Version ${version.versionNumber}`}
                                </div>
                                <p className="text-xs text-amber-200/45 font-serif italic flex items-center gap-1.5">
                                  {formatDate(version.updatedAt)} 
                                  {version.isRichText && (
                                    <>· {words} mots</>
                                  )}
                                  {version.kind === 'sheet' && version.cardCount != null && (
                                    <>· {version.cardCount} carte{version.cardCount > 1 ? 's' : ''}</>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {version.openPath && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpen(version.openPath!);
                                  }}
                                  className="text-xs bg-neutral-950 hover:bg-neutral-800 text-amber-200/80 px-2.5 py-1.5 rounded-lg border border-amber-900/30 transition cursor-pointer whitespace-nowrap"
                                >
                                  Ouvrir
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(version);
                                }}
                                className="text-xs bg-red-950/40 hover:bg-red-900/80 text-red-300 border border-red-900/30 p-1.5 rounded-lg transition cursor-pointer"
                                title="Supprimer cette version"
                              >
                                <IconDelete className="size-3.5" aria-hidden="true" />
                              </button>
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
      )}

      {selectedCompare.selected.length > 0 && selectedCompare.parentTitle && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 backdrop-blur-md border border-amber-500/50 text-amber-100 p-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 max-w-2xl w-[92%] sm:w-[94%]">
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[10px] sm:text-[11px] text-amber-400 font-semibold uppercase tracking-wider truncate">
              Dossier : {selectedCompare.parentTitle}
            </p>
            <p className="text-xs sm:text-sm font-serif truncate mt-0.5 sm:mt-0">
              {selectedCompare.selected.length === 1 ? (
                <>
                  v{selectedCompare.selected[0].versionNumber}
                  <span className="hidden sm:inline"> — Sélectionnez une 2ᵉ version dans ce dossier</span>
                  <span className="sm:hidden text-amber-200/60"> — Cochez la 2ᵉ</span>
                </>
              ) : (
                <>
                  v{selectedCompare.selected[0].versionNumber}
                  <IconCompare className="mx-2 inline size-3.5 text-amber-500" aria-hidden="true" />
                  v{selectedCompare.selected[1].versionNumber}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-center sm:justify-end">
            <button
              onClick={() => setSelectedCompare({ parentKey: null, parentTitle: null, selected: [] })}
              className="text-[11px] sm:text-xs text-amber-200/60 hover:text-amber-100 px-3 py-2 cursor-pointer"
            >
              Annuler
            </button>
            <button
              disabled={selectedCompare.selected.length < 2}
              onClick={() => {
                if (selectedCompare.selected.length === 2 && selectedCompare.parentTitle) {
                  onComparePair(selectedCompare.parentTitle, selectedCompare.selected[0], selectedCompare.selected[1]);
                }
              }}
              className={`text-[11px] sm:text-xs font-semibold px-4 py-2 sm:py-2.5 rounded-xl transition ${
                selectedCompare.selected.length === 2
                  ? 'bg-amber-600 hover:bg-amber-500 text-amber-50 shadow-md cursor-pointer'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              Lancer la comparaison
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default VersionsSection;