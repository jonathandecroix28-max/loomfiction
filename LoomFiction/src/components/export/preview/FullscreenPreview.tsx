import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayLock } from '../../../hooks/export/useOverlayLock';

type Props = { title?: string; html: string; controls: ReactNode; footer: ReactNode; onClose: () => void };

export function FullscreenPreview({ title, html, controls, footer, onClose }: Props) {
  useOverlayLock(true, onClose);
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Aperçu en plein écran"
         className="fixed inset-0 z-80 flex flex-col bg-[#1c1411] text-[#fcf9f2] font-serif">
      <div className="flex items-center justify-between gap-2 border-b border-amber-900/40 bg-neutral-950 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose}
                className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium cursor-pointer">
          ✕ Fermer
        </button>
        <span className="hidden sm:block min-w-0 truncate text-sm text-amber-200/60">{title}</span>
        {controls}
      </div>

      {html ? (
        <iframe title="Aperçu de l’export en plein écran" sandbox="" srcDoc={html}
                className="min-h-0 w-full flex-1 border-0 bg-white" />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-amber-200/50">
          Sélectionne au moins un chapitre pour générer l’aperçu.
        </div>
      )}

      {footer && (
        <div className="border-t border-amber-900/40 bg-neutral-950 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </div>,
    document.body
  );
}