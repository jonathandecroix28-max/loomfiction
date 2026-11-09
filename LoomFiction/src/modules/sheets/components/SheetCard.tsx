import { Link } from 'react-router-dom';
import type { SheetResponse } from '../../../types/sheet';
import { IconBooks, IconImport } from '../../../components/icons';

interface SheetCardProps {
  sheet: SheetResponse;
  color?: string;
  total: number;
  filled: number;
  bookTitle?: string;
  onAttach?: () => void;
}

const RING_SIZE = 44;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ filled, total, color }: { filled: number; total: number; color: string }) {
  const ratio = total ? Math.min(filled / total, 1) : 0;
  const complete = total > 0 && filled >= total;

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label={total === 0 ? 'Aucune carte' : `${filled} cartes remplies sur ${total}`}
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90" aria-hidden="true">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-amber-900/30"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-sans text-[11px] font-semibold tabular-nums ${
          complete ? 'text-amber-100' : 'text-amber-200/80'
        }`}
      >
        {total === 0 ? '–' : `${filled}/${total}`}
      </span>
    </div>
  );
}

export function SheetCard({
  sheet,
  color = '#b45309',
  total,
  filled,
  bookTitle = 'Roman non défini',
  onAttach,
}: SheetCardProps) {
  return (
    <Link
      to={`/ideas/fiches/${sheet.id}`}
      className="touch-target group relative block rounded-2xl border border-amber-900/25 bg-neutral-950/70 p-4 shadow-xl transition-all hover:border-amber-600/40"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-amber-100">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="truncate">{sheet.name}</span>
          </h3>
          <p className="mt-1 inline-flex max-w-full items-center gap-1 font-sans text-xs text-amber-300/70">
            <IconBooks className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{bookTitle}</span>
          </p>
          <p className="mt-1 font-sans text-xs text-amber-200/50">
            {total === 0
              ? 'Aucune carte'
              : total > 1
                ? 'cartes remplies'
                : 'carte remplie'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onAttach && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAttach();
              }}
              className="cursor-pointer rounded-lg border border-amber-900/30 bg-amber-950/80 px-2 py-1 text-xs font-medium text-amber-200 opacity-0 transition-opacity hover:bg-amber-900 focus:opacity-100 group-hover:opacity-100"
              title="Aspirer des notes libres vers cette fiche"
              aria-label="Aspirer des notes libres vers cette fiche"
            >
              <IconImport className="size-4" aria-hidden="true" />
            </button>
          )}
          <ProgressRing filled={filled} total={total} color={color} />
        </div>
      </div>
    </Link>
  );
}