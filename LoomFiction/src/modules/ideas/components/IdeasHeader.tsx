interface IdeasHeaderProps {
  onManageCategories: () => void;
  onNewIdea: () => void;
  onImportSheets: () => void;
  onExportSheets: () => void;
  showImportExport: boolean;
  canExport: boolean;
}

export function IdeasHeader({
  onManageCategories,
  onNewIdea,
  onImportSheets,
  onExportSheets,
  showImportExport,
  canExport,
}: IdeasHeaderProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <h1 className="text-3xl font-serif font-bold leading-tight tracking-tight text-amber-100 md:text-4xl">
        Carnet d'Inspiration Global
      </h1>

      <div className="flex w-full flex-wrap items-center justify-start gap-2 self-start md:w-auto md:self-auto">
        <button
          type="button"
          onClick={onManageCategories}
          aria-label="Gérer les catégories"
          title="Gérer les catégories"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-amber-900/40 bg-neutral-900 px-3 py-2.5 text-sm font-medium text-amber-200 shadow-sm transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 touch-target sm:px-4"
        >
          <span aria-hidden="true">⚙️</span>
          <span className="hidden sm:inline">Gérer les catégories</span>
        </button>

        <button
          type="button"
          onClick={onNewIdea}
          aria-label="Nouvelle note"
          title="Nouvelle note"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-amber-700 px-3 py-2.5 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 touch-target sm:px-5"
        >
          <span aria-hidden="true">+</span>
          <span className="hidden sm:inline">Nouvelle note</span>
        </button>

        {showImportExport && (
          <>
            <button
              type="button"
              onClick={onImportSheets}
              aria-label="Importer des fiches"
              title="Importer des fiches"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-amber-900/30 bg-neutral-900 px-3 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-neutral-800 active:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 touch-target sm:px-4"
            >
              <span aria-hidden="true">📥</span>
              <span className="hidden sm:inline">Importer des fiches</span>
            </button>
            <button
              type="button"
              onClick={onExportSheets}
              disabled={!canExport}
              aria-label="Exporter des fiches"
              title={!canExport ? 'Aucune fiche à exporter' : 'Exporter des fiches'}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-amber-900/30 bg-neutral-900 px-3 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-neutral-800 active:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-40 touch-target sm:px-4"
            >
              <span aria-hidden="true">💾</span>
              <span className="hidden sm:inline">Exporter des fiches</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
