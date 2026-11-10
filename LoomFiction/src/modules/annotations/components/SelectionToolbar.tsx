import { createPortal } from 'react-dom';
import { IconCopy, IconEdit } from '../../../components/icons';
import { stopBubbling } from '../utils/stopBubbling';
import { HIGHLIGHT_COLORS, type HighlightColor } from '../utils/types';
import type { TextSelection } from '../hooks/useTextSelection';

interface SelectionToolbarProps {
  selection: TextSelection;
  onHighlight: (color: HighlightColor) => void;
  onNote: () => void;
  onQuoteCard: () => void;
  onCopy: () => void;
}

const actionClass =
  'flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 font-sans text-xs font-medium text-amber-200 transition-colors hover:bg-neutral-900';

function IconQuoteCard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9.5 10.5c-1.2 0-2 .8-2 2s.8 2 2 2c0 1-.6 1.6-1.5 1.8M16 10.5c-1.2 0-2 .8-2 2s.8 2 2 2c0 1-.6 1.6-1.5 1.8" />
    </svg>
  );
}

export function SelectionToolbar({ selection, onHighlight, onNote, onQuoteCard, onCopy }: SelectionToolbarProps) {
  return createPortal(
    <div
      role="toolbar"
      aria-label="Annoter la sélection"
      // Garde la sélection active quand on clique sur la barre (souris)
      onMouseDown={(event) => event.preventDefault()}
      {...stopBubbling}
      className="fixed z-[70] flex items-center gap-0.5 rounded-2xl border border-amber-900/40 bg-neutral-950 p-1 shadow-2xl animate-[toast-in_160ms_ease-out]"
      style={{
        left: selection.x,
        top: selection.y,
        transform: selection.placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        maxWidth: 'calc(100vw - 1rem)',
      }}
    >
      <div className="flex items-center">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.key}
            type="button"
            onClick={() => onHighlight(color.key)}
            aria-label={`Surligner en ${color.label.toLowerCase()}`}
            title={`Surligner en ${color.label.toLowerCase()}`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-neutral-900"
          >
            <span className="size-6 rounded-full border border-black/20 shadow-sm" style={{ backgroundColor: color.swatch }} />
          </button>
        ))}
      </div>

      <span className="mx-0.5 h-6 w-px bg-amber-900/40" aria-hidden="true" />

      <button type="button" onClick={onNote} className={actionClass} aria-label="Ajouter une note de marge" title="Ajouter une note">
        <IconEdit className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Note</span>
      </button>
      <button type="button" onClick={onQuoteCard} className={actionClass} aria-label="Créer une carte de citation" title="Carte de citation">
        <IconQuoteCard className="size-4" />
        <span className="hidden sm:inline">Carte</span>
      </button>
      <button type="button" onClick={onCopy} className={actionClass} aria-label="Copier la citation" title="Copier">
        <IconCopy className="size-4" aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}