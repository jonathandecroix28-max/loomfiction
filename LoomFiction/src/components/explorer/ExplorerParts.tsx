import type { ReactNode } from 'react';
import { formatDate } from '../../utils/date/dateFormatter';


type Level = 'l1' | 'l2' | 'l3' | 'leaf';

const BOX: Record<Level, string> = {
  l1: 'min-h-10 rounded-lg',
  l2: 'min-h-9 rounded-lg',
  l3: 'min-h-8 rounded-md',
  leaf: 'min-h-9 rounded-md',
};

const TEXT: Record<Level, string> = {
  l1: 'gap-2 px-2 text-sm font-semibold',
  l2: 'gap-2 px-2 text-xs font-medium',
  l3: 'gap-1.5 px-2 text-[11px]',
  leaf: 'gap-2 px-2 text-xs',
};

const TONE: Record<Level, string> = {
  l1: 'text-amber-100 hover:bg-amber-900/20',
  l2: 'text-amber-200/90 hover:bg-amber-900/20',
  l3: 'text-amber-200/65 hover:bg-amber-900/20 hover:text-amber-100',
  leaf: 'text-amber-200/80 hover:bg-amber-900/20 hover:text-amber-100',
};

const CURRENT = 'bg-amber-900/35 text-amber-100';

export const row = (level: Level, current = false) =>
  `flex w-full min-w-0 cursor-pointer items-center text-left transition-colors ${BOX[level]} ${TEXT[level]} ${
    current ? CURRENT : TONE[level]
  }`;

export const rowShell = (level: Level, current = false) =>
  `group/row flex items-center gap-1 transition-colors ${BOX[level]} ${current ? CURRENT : TONE[level]}`;

export const rowMain = (level: Level) =>
  `flex min-h-[inherit] min-w-0 flex-1 cursor-pointer items-center self-stretch text-left ${TEXT[level]}`;

export const ROW_ACTION =
  'mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-amber-200/50 transition-colors hover:bg-amber-900/40 hover:text-amber-100 focus-visible:text-amber-100 disabled:cursor-default disabled:opacity-30';

export const TREE_BRANCH = 'ml-3.5 my-0.5 flex flex-col gap-0.5 border-l border-amber-900/40 pl-2';
export const TREE_EMPTY = 'px-2 py-1.5 text-[11px] italic text-amber-200/45';
export const TREE_COUNT = 'ml-auto shrink-0 pl-1 text-[10px] tabular-nums text-amber-200/50';
export const TREE_SECTION =
  'truncate px-2 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-amber-200/45';
export const PANEL_MESSAGE = 'px-3 py-8 text-center text-xs italic text-amber-200/50';

export const SCROLL = 'custom-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 py-2 font-sans';

export const INPUT =
  'w-full rounded-lg border border-amber-600/70 bg-neutral-900 px-2.5 py-1.5 text-xs text-amber-100 placeholder:text-amber-200/30 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';
export const INLINE_BOX = 'my-0.5 flex items-center gap-1.5 rounded-lg border border-amber-600/60 bg-amber-950/50 px-2 py-1.5';
export const INLINE_BARE =
  'w-full bg-transparent text-xs text-amber-100 placeholder:text-amber-200/30 focus:outline-none';

export function ExplorerToolbar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-900/40 bg-[var(--c-surface-2)] px-3 py-2 font-sans">
      <span className="select-none text-[11px] font-semibold uppercase tracking-widest text-amber-200/60">{title}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

export function ToolbarButton({
  onClick,
  title,
  label,
  children,
}: {
  onClick: () => void;
  title: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label}
      className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-amber-200/60 transition-colors hover:bg-amber-900/30 hover:text-amber-100"
    >
      {children}
    </button>
  );
}

export function ExplorerSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="shrink-0 border-b border-amber-900/30 px-3 py-2 font-sans">
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-lg border border-amber-900/40 bg-neutral-900 px-3 py-2 text-base text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:text-xs"
      />
    </div>
  );
}

export function ExplorerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-amber-900/30 bg-[var(--c-surface-2)] px-3 py-2 text-center font-sans text-[10px] uppercase tracking-widest text-amber-200/50">
      {children}
    </div>
  );
}


export function VersionLeaf({
  number,
  name,
  date,
  active = false,
  disabled = false,
  title,
  onSelect,
}: {
  number: number;
  name?: string | null;
  date: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onSelect: () => void;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={`absolute -left-[0.8125rem] top-1/2 size-2 -translate-y-1/2 rounded-full border ${
          active ? 'border-amber-500 bg-amber-500' : 'border-amber-500/60 bg-[var(--c-surface)]'
        }`}
      />
      <button
        type="button"
        data-active={active}
        disabled={disabled}
        title={title}
        onClick={onSelect}
        className={`flex min-h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          active ? 'bg-amber-700 text-amber-50' : 'text-amber-200/80 hover:bg-amber-900/20 hover:text-amber-100'
        }`}
      >
        <span className="shrink-0 font-semibold">v{number}</span>
        <span className="min-w-0 flex-1 truncate">{name || 'Sans nom'}</span>
        <span className={`shrink-0 text-[10px] ${active ? 'text-amber-100/80' : 'text-amber-200/45'}`}>{formatDate(date)}</span>
      </button>
    </div>
  );
}