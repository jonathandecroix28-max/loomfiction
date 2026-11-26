export const btnBase = 'rounded-lg border text-xs font-medium transition-colors cursor-pointer';

export const choiceBtn = (active: boolean) =>
  `px-2.5 py-1.5 rounded-md text-xs border cursor-pointer ${
    active ? 'bg-amber-700 text-amber-50 border-amber-600' : 'bg-neutral-900 text-amber-200 border-amber-900/30'
  }`;

export const toggleBtn = (active: boolean) =>
  `px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
    active ? 'bg-amber-700 text-amber-50 border-amber-600' : 'bg-neutral-900 text-amber-200 border-amber-900/30'
  }`;

export const ghostBtn =
  'px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-200 text-sm font-medium transition-colors border border-amber-900/30 cursor-pointer';