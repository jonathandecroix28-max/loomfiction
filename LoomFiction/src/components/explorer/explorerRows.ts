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