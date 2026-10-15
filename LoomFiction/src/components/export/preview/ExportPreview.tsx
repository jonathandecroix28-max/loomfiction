import type { ReactNode } from 'react';
import { labelClass, sectionClass, smallBtn } from '../../../utils/export/ui';

type Props = {
  show: boolean;
  html: string;
  canAct: boolean;
  fullscreen: boolean;
  hasBook: boolean;
  bookLoading: boolean;
  hasSelection: boolean;
  controls: ReactNode;
  moreButton: ReactNode;
  onToggle: () => void;
  onFullscreen: () => void;
};

export function ExportPreview(p: Props) {
  const emptyText = p.bookLoading
    ? 'Chargement...'
    : !p.hasBook
      ? 'Choisis un roman pour prévisualiser l’export.'
      : !p.hasSelection
        ? 'Sélectionne au moins un chapitre pour générer l’aperçu.'
        : 'Rien à afficher pour le moment.';

  return (
    <section className={`${sectionClass} lg:sticky lg:top-24`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={labelClass}>Aperçu</span>
          <p className="text-xs text-amber-200/40 mt-1">
            Mise en page indicative : le rendu final dépend du format choisi.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={p.onFullscreen} disabled={!p.canAct}
                  className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs font-medium cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed">
            ⛶ Plein écran
          </button>
          <button type="button" onClick={p.onToggle} className={smallBtn}>{p.show ? 'Masquer' : 'Afficher'}</button>
        </div>
      </div>

      {p.show && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-amber-200/40">Texte et papier</span>
            {p.controls}
          </div>

          {!p.fullscreen && (
            p.html ? (
              <iframe title="Aperçu de l’export" sandbox="" srcDoc={p.html}
                      className="w-full h-[55vh] lg:h-[calc(100vh-17rem)] rounded-xl border border-amber-900/20 bg-white" />
            ) : (
              <div className="rounded-xl border border-dashed border-amber-900/30 py-16 text-center text-sm text-amber-200/50">
                {emptyText}
              </div>
            )
          )}
          {!p.fullscreen && p.moreButton}
        </>
      )}
    </section>
  );
}