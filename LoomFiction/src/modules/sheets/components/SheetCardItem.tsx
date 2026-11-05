import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { IdeaResponse } from '../../../types/idea';
import { IconDelete, IconDown, IconEdit, IconUp } from '../../../components/icons';
import { ActionMenu } from './ActionMenu';

interface SheetCardItemProps {
  card: IdeaResponse;
  index: number;
  total: number;
  autoFocus?: boolean;
  onMove: (index: number, delta: -1 | 1) => void;
  onEdit: (card: IdeaResponse) => void;
  onDelete: (card: IdeaResponse) => void;
  onSaveDescription: (card: IdeaResponse, description: string) => Promise<boolean>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DELAY = 900;

const iconBtn =
  'touch-target inline-flex min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2.5 transition disabled:cursor-not-allowed disabled:opacity-30';

export function SheetCardItem({
  card,
  index,
  total,
  autoFocus = false,
  onMove,
  onEdit,
  onDelete,
  onSaveDescription,
}: SheetCardItemProps) {
  const incoming = card.description ?? '';
  const [value, setValue] = useState(incoming);
  const [state, setState] = useState<SaveState>('idle');

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(incoming);
  const savedRef = useRef(incoming);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef(card);
  const saveRef = useRef(onSaveDescription);
  cardRef.current = card;
  saveRef.current = onSaveDescription;

  // Texte modifié ailleurs (fenêtre « Éditer », rechargement) : on le reprend s'il n'y a pas de saisie en cours
  useEffect(() => {
    if (valueRef.current === savedRef.current && incoming !== savedRef.current) {
      savedRef.current = incoming;
      valueRef.current = incoming;
      setValue(incoming);
    }
  }, [incoming]);

  const flush = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = valueRef.current;
    if (next === savedRef.current) return;

    setState('saving');
    const ok = await saveRef.current(cardRef.current, next);
    if (!ok) {
      setState('error');
      return;
    }
    savedRef.current = next;
    setState(valueRef.current === next ? 'saved' : 'idle');
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const handleChange = (text: string) => {
    setValue(text);
    valueRef.current = text;
    setState('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushRef.current(), SAVE_DELAY);
  };

  // Ce qui est tapé n'est jamais perdu : on enregistre aussi en quittant la page
  useEffect(
    () => () => {
      void flushRef.current();
    },
    []
  );

  useEffect(() => {
    if (!autoFocus) return;
    const area = areaRef.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, [autoFocus]);

  // Le champ grandit avec le texte
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  }, [value]);

  return (
    <div className="rounded-2xl border border-amber-900/25 bg-neutral-950/70 p-4 shadow-xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-bold text-amber-100 wrap-break-word sm:text-xl">{card.name}</h3>
          <p role="status" className={`mt-0.5 h-4 font-sans text-[11px] ${state === 'error' ? 'text-red-400' : 'text-amber-200/50'}`}>
            {state === 'saving' && 'Enregistrement…'}
            {state === 'saved' && 'Enregistré'}
            {state === 'error' && (
              <>
                Échec de l’enregistrement.{' '}
                <button type="button" onClick={() => void flush()} className="cursor-pointer underline">
                  Réessayer
                </button>
              </>
            )}
          </p>
        </div>

        {/* Grand écran : les actions restent visibles */}
        <div className="hidden shrink-0 items-center gap-1.5 font-sans sm:flex">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            aria-label="Monter la carte"
            title="Monter"
            className={`${iconBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <IconUp className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label="Descendre la carte"
            title="Descendre"
            className={`${iconBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <IconDown className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(card)}
            aria-label="Modifier le titre"
            title="Modifier le titre"
            className={`${iconBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <IconEdit className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(card)}
            aria-label="Supprimer la carte"
            title="Supprimer la carte"
            className={`${iconBtn} border-red-900/30 bg-red-950/50 text-red-300 hover:bg-red-900/80`}
          >
            <IconDelete className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mobile : un seul bouton, les actions sont dans le menu */}
        <ActionMenu
          className="shrink-0 sm:hidden"
          label={`Actions de la carte ${card.name}`}
          items={[
            { key: 'up', label: 'Monter', icon: IconUp, disabled: index === 0, onSelect: () => onMove(index, -1) },
            { key: 'down', label: 'Descendre', icon: IconDown, disabled: index === total - 1, onSelect: () => onMove(index, 1) },
            { key: 'edit', label: 'Modifier le titre', icon: IconEdit, onSelect: () => onEdit(card) },
            { key: 'delete', label: 'Supprimer la carte', icon: IconDelete, danger: true, separatorBefore: true, onSelect: () => onDelete(card) },
          ]}
        />
      </div>

      <div className="mt-3 border-t border-amber-900/20 pt-3">
        <textarea
          ref={areaRef}
          value={value}
          rows={2}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => void flush()}
          aria-label={`Texte de la caractéristique ${card.name}`}
          placeholder="À compléter… écrivez directement ici"
          className="block w-full resize-none rounded-xl border border-transparent bg-transparent px-3 py-2 font-serif leading-relaxed text-amber-200/90 transition placeholder:italic placeholder:text-amber-200/30 hover:border-amber-900/30 focus:border-amber-600/60 focus:bg-neutral-900/60 focus:outline-none"
        />
      </div>
    </div>
  );
}