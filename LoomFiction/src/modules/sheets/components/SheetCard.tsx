import { Link } from 'react-router-dom';
import type { SheetResponse } from '../../../types/sheet';

interface SheetCardProps {
  sheet: SheetResponse;
  color?: string;
  total: number;
  filled: number;
  bookTitle?: string;
}

export function SheetCard({ sheet, color = '#b45309', total, filled, bookTitle = 'Roman non défini' }: SheetCardProps) {
  const percent = total ? Math.round((filled / total) * 100) : 0;

  return (
    <Link
      to={`/ideas/fiches/${sheet.id}`}
      className="touch-target block rounded-2xl border border-amber-900/25 bg-neutral-950/70 p-4 shadow-xl transition-all hover:border-amber-600/40"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <h3 className="truncate font-serif text-lg font-bold text-amber-100">{sheet.name}</h3>
      <p className="mt-1 truncate font-sans text-xs text-amber-300/70">📚 {bookTitle}</p>
      <p className="mt-1 font-sans text-xs text-amber-200/50">
        {total === 0 ? 'Aucune carte' : `${filled}/${total} ${total > 1 ? 'cartes remplies' : 'carte remplie'}`}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-900/30">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </Link>
  );
}