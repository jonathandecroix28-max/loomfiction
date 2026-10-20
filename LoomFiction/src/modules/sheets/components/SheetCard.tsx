import { Link } from 'react-router-dom';
import type { SheetResponse } from '../../../types/sheet';

interface SheetCardProps {
  sheet: SheetResponse;
  color?: string;
  total: number;
  filled: number;
  bookTitle?: string;
  onAttach?: () => void;
}

export function SheetCard({ sheet, color = '#b45309', total, filled, bookTitle = 'Roman non défini', onAttach }: SheetCardProps) {
  const percent = total ? Math.round((filled / total) * 100) : 0;

  return (
    <Link
      to={`/ideas/fiches/${sheet.id}`}
      className="touch-target relative group block rounded-2xl border border-amber-900/25 bg-neutral-950/70 p-4 shadow-xl transition-all hover:border-amber-600/40"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-lg font-bold text-amber-100">{sheet.name}</h3>
          <p className="mt-1 truncate font-sans text-xs text-amber-300/70">📚 {bookTitle}</p>
        </div>

        {onAttach && (
          <button
            onClick={(e) => {
              e.preventDefault(); 
              e.stopPropagation(); 
              onAttach();
            }}
            className="shrink-0 opacity-0 focus:opacity-100 group-hover:opacity-100 transition-opacity text-xs bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-900/30 px-2 py-1 rounded-lg font-medium cursor-pointer"
            title="Aspirer des notes libres vers cette fiche"
          >
            📥
          </button>
        )}
      </div>

      <p className="mt-2 font-sans text-xs text-amber-200/50">
        {total === 0 ? 'Aucune carte' : `${filled}/${total} ${total > 1 ? 'cartes remplies' : 'carte remplie'}`}
      </p>
      
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-900/30">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </Link>
  );
}