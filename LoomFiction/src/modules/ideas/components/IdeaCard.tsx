import type { IdeaResponse, IdeaStatus } from '../../../types/idea';
import { formatDate } from '../../../utils/date/dateFormatter';
import type { LucideIcon } from '../../../components/icons';
import {
  IconAttach,
  IconBooks,
  IconDelete,
  IconDone,
  IconEdit,
  IconHistory,
  IconIdea,
  IconSheet,
  IconWrench,
} from '../../../components/icons';

interface IdeaCardProps {
  idea: IdeaResponse & { bookTitle?: string; sheetName?: string };
  onEdit: (idea: IdeaResponse) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  onVersions: (idea: IdeaResponse) => void;
  onAttach?: () => void;
}

const statusConfig: Record<IdeaStatus, { label: string; Icon: LucideIcon; bg: string; text: string; border: string }> = {
  draft: { label: 'Idée brute', Icon: IconIdea, bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-800/40' },
  'in-progress': { label: 'En cours', Icon: IconWrench, bg: 'bg-blue-950/60', text: 'text-blue-300', border: 'border-blue-800/40' },
  integrated: { label: 'Intégrée', Icon: IconDone, bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-800/40' },
};

export function IdeaCard({ idea, onEdit, onDelete, onVersions, onAttach }: IdeaCardProps) {
  const currentStatus = idea.status ? statusConfig[idea.status] : statusConfig['draft'];
  const StatusIcon = currentStatus.Icon;

  return (
    <div className="bg-neutral-950/70 border border-amber-900/25 rounded-2xl p-5 shadow-xl hover:border-amber-600/40 transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium px-2.5 py-1 rounded-full border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border} whitespace-nowrap`}>
              <StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />
              {currentStatus.label}
            </span>

            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-serif text-amber-400 font-medium whitespace-nowrap">
              <IconBooks className="size-3.5 shrink-0" aria-hidden="true" />
              {idea.bookTitle || 'Roman non rattaché'}
            </span>

            {idea.sheetName && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-serif text-amber-300/80 font-medium whitespace-nowrap">
                <IconSheet className="size-3.5 shrink-0" aria-hidden="true" />
                {idea.sheetName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
            {onAttach && !idea.sheetName && (
              <button
                onClick={(e) => { e.stopPropagation(); onAttach(); }}
                className="w-8 h-8 flex items-center justify-center bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-900/30 rounded-lg transition cursor-pointer"
                title="Rattacher à une fiche"
                aria-label="Rattacher à une fiche"
              >
                <IconAttach className="size-4" aria-hidden="true" />
              </button>
            )}

            <button
              onClick={() => onVersions(idea)}
              className="w-8 h-8 flex items-center justify-center bg-neutral-900/80 hover:bg-neutral-800 text-amber-200 border border-amber-900/30 rounded-lg transition cursor-pointer"
              title="Historique des versions"
              aria-label="Historique des versions"
            >
              <IconHistory className="size-4" aria-hidden="true" />
            </button>
            
            <button
              onClick={() => onEdit(idea)}
              className="w-8 h-8 flex items-center justify-center bg-neutral-900/80 hover:bg-neutral-800 text-amber-200 border border-amber-900/30 rounded-lg transition cursor-pointer"
              title="Éditer"
              aria-label="Éditer"
            >
              <IconEdit className="size-4" aria-hidden="true" />
            </button>
            
            <button
              onClick={(e) => onDelete(idea.id, e)}
              className="w-8 h-8 flex items-center justify-center bg-red-950/40 hover:bg-red-900/80 text-red-400 border border-red-900/30 rounded-lg transition cursor-pointer"
              title="Supprimer"
              aria-label="Supprimer"
            >
              <IconDelete className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Contenu principal */}
        <h3 className="font-serif font-bold text-amber-100 text-lg md:text-xl tracking-tight mb-2 pr-2">
          {idea.name}
        </h3>

        <div className="text-amber-200/70 font-serif text-sm md:text-base leading-relaxed whitespace-pre-wrap pt-3 border-t border-amber-900/20 mb-4 wrap-break-word">
          {idea.description || "Aucune description détaillée."}
        </div>
      </div>

      {/* Pied de carte */}
      <div className="pt-3 border-t border-amber-900/20 flex items-center justify-between text-[11px] text-amber-200/40 font-serif mt-auto">
        <span>Créée le {formatDate(idea.createdAt)}</span>
      </div>
    </div>
  );
}