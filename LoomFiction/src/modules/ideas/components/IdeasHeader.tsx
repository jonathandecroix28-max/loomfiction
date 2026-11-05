
import { useState } from 'react';
import {
  IconAdd,
  IconImport,
  IconExport,
  IconMore,
  IconSettings,
} from '../../../components/icons';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Titre de la page */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-amber-100 md:text-4xl">
          Carnet d'Inspiration Global
        </h1>
      </div>

      {/* Menu des actions */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-[45] sm:bottom-auto sm:right-6 sm:top-24">
        {/* Bouton trois points */}
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label={
            isMenuOpen
              ? 'Fermer le menu des actions'
              : 'Afficher les actions'
          }
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
          title="Actions du carnet"
          className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-amber-900/50 bg-neutral-950 text-amber-100 shadow-xl backdrop-blur transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 touch-target"
        >
          <IconMore className="size-6" aria-hidden="true" />
        </button>

        {/* Menu déroulant */}
        {isMenuOpen && (
          <div
            role="menu"
            aria-label="Actions du carnet d'inspiration"
            className="absolute bottom-full right-0 mb-2 flex min-w-56 flex-col gap-1 rounded-2xl border border-amber-900/50 bg-neutral-950 p-2 text-amber-100 shadow-2xl backdrop-blur-xl sm:bottom-auto sm:top-full sm:mt-2 sm:mb-0"
          >
            {/* Gestion des catégories */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(onManageCategories)}
              aria-label="Gérer les catégories"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-amber-200 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <IconSettings className="size-4 shrink-0" aria-hidden="true" />
              <span>Gérer les catégories</span>
            </button>

            {/* Nouvelle note */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction(onNewIdea)}
              aria-label="Créer une nouvelle note"
              className="flex min-h-11 items-center gap-3 rounded-xl bg-amber-700 px-3 py-2.5 text-left text-sm font-semibold text-amber-50 transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <IconAdd className="size-4 shrink-0" aria-hidden="true" />
              <span>Nouvelle note</span>
            </button>

            {/* Importation et exportation */}
            {showImportExport && (
              <>
                <div className="my-1 border-t border-amber-900/40" />

                {/* Importer */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleAction(onImportSheets)}
                  aria-label="Importer des fiches"
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-amber-200 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <IconImport className="size-4 shrink-0" aria-hidden="true" />
                  <span>Importer des fiches</span>
                </button>

                {/* Exporter */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleAction(onExportSheets)}
                  disabled={!canExport}
                  aria-label="Exporter des fiches"
                  title={
                    !canExport
                      ? 'Aucune fiche à exporter'
                      : 'Exporter des fiches'
                  }
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-amber-200 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <IconExport className="size-4 shrink-0" aria-hidden="true" />
                  <span>Exporter des fiches</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
