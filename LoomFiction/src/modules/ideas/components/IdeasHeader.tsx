
interface IdeasHeaderProps {
  onManageCategories: () => void;
  onNewIdea: () => void;
}

export function IdeasHeader({ onManageCategories, onNewIdea }: IdeasHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <h1 className="text-3xl md:text-4xl font-serif font-bold text-amber-100 tracking-tight leading-tight">
        Carnet d'Inspiration Global
      </h1>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-auto w-full md:w-auto">
        <button
          onClick={onManageCategories}
          className="bg-neutral-900 hover:bg-neutral-800 text-amber-200 border border-amber-900/40 font-medium px-4 py-2.5 rounded-xl transition text-sm cursor-pointer shadow-sm inline-flex items-center justify-center gap-1.5 w-full sm:w-auto touch-target"
        >
          <span>⚙️</span> Gérer les catégories
        </button>

        <button
          onClick={onNewIdea}
          className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium px-5 py-2.5 rounded-xl transition text-sm cursor-pointer shadow-md inline-flex items-center justify-center gap-2 w-full sm:w-auto touch-target"
        >
          <span>+</span> Nouvelle note
        </button>
      </div>
    </div>
  );
}