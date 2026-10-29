import type { EdgePull } from '../hooks/useEdgeSwipeNavigation';

type Props = { pull: EdgePull; prevLabel?: string; nextLabel?: string };

export function EdgeSwipeHint({ pull, prevLabel, nextLabel }: Props) {
  if (!pull) return null;

  const isNext = pull.direction === 'next';
  const ready = pull.progress >= 1;
  const label = isNext ? nextLabel : prevLabel;
  const position = isNext
    ? 'bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]'
    : 'top-[calc(env(safe-area-inset-top)+5rem)]';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 ${position}`}
      style={{
        opacity: Math.max(0.4, pull.progress),
        transform: `translateY(${(isNext ? -1 : 1) * pull.progress * 12}px)`,
      }}
    >
      <div className="w-64 max-w-full rounded-2xl border border-amber-900/40 bg-neutral-950/90 px-4 py-3 font-sans text-xs text-amber-100 shadow-lg backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{isNext ? '↑' : '↓'}</span>
          <span className="truncate">
            {ready ? 'Relâche pour ouvrir' : isNext ? 'Continue : chapitre suivant' : 'Continue : chapitre précédent'}
          </span>
        </div>
        {label && <div className="mt-1 truncate text-amber-200/60">{label}</div>}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-amber-900/30">
          <div
            className={`h-full rounded-full transition-colors ${ready ? 'bg-emerald-400' : 'bg-amber-500'}`}
            style={{ width: `${pull.progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}