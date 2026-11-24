import type { ReactNode } from 'react';
import type { SortBy } from '../../hooks/versions/useVersionCompare';
import { btnBase } from '../../utils/versions/versionStyles';
import { IconBack, IconMenu } from '../icons';
import '../diff/diff.css';

/* ───────────────────────── États de la page ───────────────────────── */

export function VersionsLoading() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[var(--c-page)] flex items-center justify-center font-serif text-amber-200/60 py-24">
      Consultation de l’historique...
    </div>
  );
}

export function VersionsError({ message }: { message: string }) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[var(--c-page)] text-[var(--c-ink)] font-serif px-4 py-20">
      <div className="max-w-xl mx-auto rounded-2xl border border-red-900/30 bg-red-950/20 p-6 text-center text-red-200">
        {message}
      </div>
    </div>
  );
}

export function FeedbackBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-2xl border border-emerald-900/30 bg-emerald-950/30 px-4 py-3 text-emerald-300 text-sm font-medium">
      {message}
    </div>
  );
}

/* ───────────────────────── En-tête ───────────────────────── */

interface HeaderProps {
  title: string;
  subtitle: string;
  backLabel: string;
  openLabel: string;
  onBack: () => void;
  versionsCount: number;
  selectedNumber: number | null;
  onOpenExplorer?: () => void;
  explorerOpen?: boolean;
}

export function VersionsHeader({
  title,
  subtitle,
  backLabel,
  openLabel,
  onBack,
  versionsCount,
  selectedNumber,
  onOpenExplorer,
  explorerOpen = false,
}: HeaderProps) {
  return (
    <header className="loom border-b border-amber-900/40 bg-neutral-950/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-3 sm:mb-2">
          {onOpenExplorer && !explorerOpen && (
            <button
              onClick={onOpenExplorer}
              title="Ouvrir l’explorateur"
              aria-expanded={explorerOpen}
              className="touch-target flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-900/40 bg-neutral-900 text-amber-200/70 shadow-md transition-colors hover:bg-amber-900/20 hover:text-amber-100"
            >
              <IconMenu className="size-5" aria-hidden="true" />
            </button>
          )}
          <button
            onClick={onBack}
            className="text-amber-200/60 hover:text-amber-100 transition-colors text-sm cursor-pointer flex items-center gap-1 font-sans"
          >
            <IconBack className="size-4" aria-hidden="true" /> {backLabel}
          </button>
          </div>
          <h1 className="text-xl sm:text-3xl font-bold text-amber-100">{title}</h1>
          <p className="text-sm text-amber-200/50 mt-1 truncate">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
          <Stat label="Versions" value={String(versionsCount)} />
          <Stat label="Sélection" value={selectedNumber != null ? `v${selectedNumber}` : '-'} />
          <button
            onClick={onBack}
            className="hidden sm:block px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-amber-900/30 text-amber-200 text-sm font-medium transition-colors cursor-pointer"
          >
            {openLabel}
          </button>
        </div>
      </div>
      <div className="ld-stitchline" aria-hidden="true" />
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-amber-900/30 bg-neutral-900 px-3 sm:px-4 py-2 sm:py-3 sm:min-w-28">
      <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-amber-200/40">{label}</div>
      <div className="text-lg sm:text-xl font-bold text-amber-100">{value}</div>
    </div>
  );
}

/* ───────────────────────── Filtres ───────────────────────── */

export function ToolbarButton({
  onClick,
  children,
  accent = false,
}: {
  onClick: () => void;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`${btnBase} px-2 sm:px-3 py-2 border-amber-900/30 ${
        accent ? 'bg-amber-950' : 'bg-neutral-900'
      } text-amber-200`}
    >
      {children}
    </button>
  );
}

interface FilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  sortBy: SortBy;
  onSort: (value: SortBy) => void;
  children?: ReactNode;
  actionsClassName?: string;
}

export function VersionsFilterBar({
  search,
  onSearch,
  sortBy,
  onSort,
  children,
  actionsClassName = 'grid grid-cols-2 gap-2 lg:flex',
}: FilterBarProps) {
  return (
    <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/55 p-3 sm:p-5 shadow-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 lg:grid-cols-[minmax(0,1fr)_180px] flex-1">
          <div>
            <label className="block text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40 mb-1.5">Filtrer</label>
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Nom, version, id..."
              className="w-full rounded-xl border border-amber-900/30 bg-neutral-900 px-3 sm:px-4 py-2.5 sm:py-3 text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40 mb-1.5">Trier</label>
            <select
              value={sortBy}
              onChange={(e) => onSort(e.target.value as SortBy)}
              className="w-full rounded-xl border border-amber-900/30 bg-neutral-900 px-3 sm:px-4 py-2.5 sm:py-3 text-amber-100 focus:outline-none"
            >
              <option value="newest">Récentes</option>
              <option value="oldest">Anciennes</option>
              <option value="version">N° version</option>
            </select>
          </div>
        </div>

        {children && <div className={actionsClassName}>{children}</div>}
      </div>
    </section>
  );
}

/* ───────────────────────── Appliquer une version ───────────────────────── */

interface MergeOptionsProps<K extends string> {
  fields: readonly { key: K; label: string }[];
  value: Record<K, boolean>;
  onChange: (next: Record<K, boolean>) => void;
  onMerge: () => void;
  isRestoring: boolean;
  actionLabel?: string;
  summary?: string;
  disabled?: boolean;
}

export function MergeOptions<K extends string>({
  fields,
  value,
  onChange,
  onMerge,
  isRestoring,
  actionLabel = 'Appliquer',
  summary,
  disabled = false,
}: MergeOptionsProps<K>) {
  const nothingSelected = fields.every((field) => !value[field.key]);
  const blocked = disabled || nothingSelected || isRestoring;

  return (
    <div className="loom space-y-3 rounded-xl border border-amber-900/20 bg-neutral-950/60 p-3 sm:rounded-2xl sm:p-5">
      <div>
        <p className="text-sm font-medium text-amber-100">Que veux-tu appliquer ?</p>
        <p className="mt-0.5 font-sans text-xs text-amber-200/60">
          Rien n’est modifié tant que tu n’as pas cliqué sur le bouton du bas.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 font-sans">
        {fields.map((field) => {
          const on = value[field.key];
          return (
            <button
              key={field.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...value, [field.key]: !on })}
              className={`touch-target inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition sm:min-h-0 ${
                on
                  ? 'border-amber-600 bg-amber-700 text-amber-50'
                  : 'border-amber-900/40 bg-neutral-900 text-amber-200/70 hover:bg-neutral-800'
              }`}
            >
              <span aria-hidden="true" className="w-3 text-center">
                {on ? '✓' : ''}
              </span>
              {field.label}
            </button>
          );
        })}
      </div>

      <p className="font-sans text-xs text-amber-200/70">
        {nothingSelected
          ? 'Sélectionne au moins un élément à appliquer.'
          : (summary ?? 'Les éléments sélectionnés remplaceront ceux de l’élément actuel.')}
      </p>

      <button
        type="button"
        onClick={onMerge}
        disabled={blocked}
        className="touch-target w-full cursor-pointer rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-medium text-amber-50 shadow-md transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {isRestoring ? 'Application en cours...' : actionLabel}
      </button>
    </div>
  );
}