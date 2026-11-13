import { useMemo, useState, type ReactNode } from 'react';
import type { VersionRow } from '../versionsHubTypes';
import {
  ToolbarButton,
} from './VersionParts';

interface VersionsSectionProps {
  title: string;
  subtitle: string;
  tag: string;
  emptyLabel: string;
  contextLabel: string;
  rows: VersionRow[];
  renderContext: (row: VersionRow) => ReactNode;
  onOpen: (path: string) => void;
  onDelete: (row: VersionRow) => void | Promise<void>;
  onComparePair: (
    parentTitle: string,
    versionA: VersionRow,
    versionB: VersionRow
  ) => void;
}

const dateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      { parentTitle: string; versions: VersionRow[]; sample: VersionRow }
    >();

    for (const row of rows) {
      const existing = grouped.get(row.parentKey);
      if (existing) {
        existing.versions.push(row);
      } else {
        grouped.set(row.parentKey, {
          parentTitle: row.parentTitle,
          versions: [row],
          sample: row,
        });
      }
    }

    return [...grouped.entries()]
      .map(([parentKey, group]) => ({
        parentKey,
        ...group,
        versions: [...group.versions].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() -
            new Date(a.updatedAt).getTime()
        ),
      }))
      .sort(
        (a, b) =>
          new Date(b.versions[0]?.updatedAt ?? 0).getTime() -
          new Date(a.versions[0]?.updatedAt ?? 0).getTime()
      );
  }, [rows]);

  const toggleGroup = (parentKey: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(parentKey)) next.delete(parentKey);
      else next.add(parentKey);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(groups.map((group) => group.parentKey)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-amber-200/40">
            {tag}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-amber-100">{title}</h2>
          <p className="mt-1 text-sm text-amber-200/55">{subtitle}</p>
        </div>
        {groups.length > 0 && (
          <div className="flex gap-2">
            <ToolbarButton onClick={expandAll}>Tout déplier</ToolbarButton>
            <ToolbarButton onClick={collapseAll}>Tout replier</ToolbarButton>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-amber-900/25 bg-neutral-950/55 px-4 py-8 text-center text-sm text-amber-200/50">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expanded.has(group.parentKey);
            const latest = group.versions[0];
            const canCompare = group.versions.length >= 2;

            return (
              <article
                key={group.parentKey}
                className="overflow-hidden rounded-2xl border border-amber-900/25 bg-neutral-950/55 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.parentKey)}
                  aria-expanded={isExpanded}
                  className="flex w-full min-w-0 items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-neutral-900/60 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-amber-100">
                        {group.parentTitle}
                      </h3>
                      <span className="rounded-full border border-amber-900/30 bg-neutral-900 px-2 py-0.5 text-[10px] text-amber-200/70">
                        {group.versions.length} version{group.versions.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {renderContext(group.sample)}
                      {latest && (
                        <span className="text-[11px] text-amber-200/40">
                          Dernière modification : {dateLabel(latest.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-amber-200/60" aria-hidden="true">
                    {isExpanded ? '−' : '+'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-2 border-t border-amber-900/20 p-3 sm:p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-amber-200/40">
                        {contextLabel}
                      </span>
                      {canCompare && (
                        <button
                          type="button"
                          onClick={() =>
                            onComparePair(group.parentTitle, group.versions[1], group.versions[0])
                          }
                          className="rounded-lg border border-amber-700/40 bg-amber-950/60 px-3 py-2 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/60"
                        >
                          Comparer les deux dernières
                        </button>
                      )}
                    </div>

                    {group.versions.map((row) => (
                      <div
                        key={row.key}
                        className="flex flex-col gap-3 rounded-xl border border-amber-900/20 bg-neutral-900/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-amber-100">
                              v{row.versionNumber}
                            </span>
                            {row.versionName && (
                              <span className="truncate text-sm text-amber-200/75">
                                {row.versionName}
                              </span>
                            )}
                            {row.missing && (
                              <span className="rounded-full border border-red-900/40 bg-red-950/40 px-2 py-0.5 text-[10px] text-red-300">
                                Parent introuvable
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-amber-200/40">
                            {dateLabel(row.updatedAt)}
                            {row.cardCount != null ? ` · ${row.cardCount} carte(s)` : ''}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {row.openPath && (
                            <button
                              type="button"
                              onClick={() => onOpen(row.openPath!)}
                              className="rounded-lg border border-amber-800/40 bg-amber-950/50 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-900/60"
                            >
                              Ouvrir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void onDelete(row)}
                            className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/60"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default VersionsSection;
