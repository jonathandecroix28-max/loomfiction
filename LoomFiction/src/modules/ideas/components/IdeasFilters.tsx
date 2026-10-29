import type { IdeaStatus } from '../../../types/idea';

interface IdeasFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  bookFilter: string;
  onBookFilterChange: (val: string) => void;
  statusFilter: IdeaStatus | 'all';
  onStatusFilterChange: (val: IdeaStatus | 'all') => void;
}

export function IdeasFilters({
  search, onSearchChange,
  bookFilter, onBookFilterChange,
  statusFilter, onStatusFilterChange
}: IdeasFiltersProps) {
  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6">
      <input
        type="text"
        placeholder="🔍 Rechercher dans les notes et les fiches..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full sm:w-96 bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif placeholder:text-amber-200/30"
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
        <input
          type="text"
          placeholder="📚 Filtrer par titre de roman..."
          value={bookFilter}
          onChange={(e) => onBookFilterChange(e.target.value)}
          className="w-full sm:w-64 bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif placeholder:text-amber-200/30 touch-target"
        />

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as IdeaStatus | 'all')}
          className="bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-2.5 text-sm text-amber-200/80 focus:outline-none font-serif cursor-pointer touch-target"
        >
          <option value="all">Tous les statuts</option>
          <option value="draft">💡 Brutes</option>
          <option value="in-progress">🛠️ En cours</option>
          <option value="integrated">✅ Intégrées</option>
        </select>
      </div>
    </div>
  );
}