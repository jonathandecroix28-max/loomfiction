import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { Editor } from '@tiptap/core';
import { useNavigate } from 'react-router-dom';
import type { IdeaResponse } from '../../../types/idea';
import type { SheetResponse } from '../../../types/sheet';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { useLatestGetter } from '../../../hooks/useLatestGetter';
import { createSheetMentionExtension } from '../../editor/extensions/SheetMention';
import { setupMentionPopovers } from '../../editor/utils/setupMentionPopovers';
import { htmlToText } from '../../../utils/versions/htmlText';
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
  onEditorChange?: (cardId: number, editor: Editor | null) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const SAVE_DELAY = 900;
const iconBtn =
  'touch-target inline-flex min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2.5 transition disabled:cursor-not-allowed disabled:opacity-30';

export function SheetCardItem({
  card,
  index,
  total,
  onMove,
  onEdit,
  onDelete,
  onSaveDescription,
  onEditorChange,
}: SheetCardItemProps) {
  const navigate = useNavigate();
  const incoming = card.description ?? '';
  const [state, setState] = useState<SaveState>('idle');
  const [isEmpty, setIsEmpty] = useState(() => htmlToText(incoming).trim() === '');
  const [sheets, setSheets] = useState<SheetResponse[]>([]);

  const cardContainerRef = useRef<HTMLDivElement>(null);
  const getSheets = useLatestGetter(sheets);

  const valueRef = useRef(incoming);
  const savedRef = useRef(incoming);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef(card);
  const saveRef = useRef(onSaveDescription);

  useLayoutEffect(() => {
    cardRef.current = card;
    saveRef.current = onSaveDescription;
  }, [card, onSaveDescription]);

  useEffect(() => {
    void offlineSheetService.getAll().then(setSheets);
  }, []);

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
  useLayoutEffect(() => {
    flushRef.current = flush;
  }, []);

  const editor = useEditor({
    extensions: [StarterKit, createSheetMentionExtension(getSheets)],
    content: incoming,
    editorProps: {
      attributes: {
        class:
          'block w-full rounded-xl border border-transparent bg-transparent px-3 py-2 font-serif leading-relaxed text-amber-200/90 transition focus:border-amber-600/60 focus:bg-neutral-900/60 focus:outline-none min-h-[4rem]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.getHTML();
      valueRef.current = text;
      setIsEmpty(ed.isEmpty);
      setState('idle');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flushRef.current(), SAVE_DELAY);
    },
  });

  useEffect(() => {
    if (!cardContainerRef.current || !editor) return;
    
    const tippyDelegate = setupMentionPopovers(
      cardContainerRef.current, 
      (path: string) => navigate(path), 
      editor
    );
    
    return () => tippyDelegate.destroy();
  }, [editor, navigate]);

  useEffect(() => {
    if (!editor) return;
    onEditorChange?.(card.id, editor);
    return () => onEditorChange?.(card.id, null);
  }, [editor, card.id, onEditorChange]);

  return (
    <div ref={cardContainerRef} className="rounded-2xl border border-amber-900/25 bg-neutral-950/70 p-4 shadow-xl sm:p-5">
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

        <div className="hidden shrink-0 items-center gap-1.5 font-sans sm:flex">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            aria-label="Monter la carte"
            className={`${iconBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <IconUp className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label="Descendre la carte"
            className={`${iconBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <IconDown className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(card)}
            aria-label="Modifier le titre"
            className={`${iconBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
          >
            <IconEdit className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(card)}
            aria-label="Supprimer la carte"
            className={`${iconBtn} border-red-900/30 bg-red-950/50 text-red-300 hover:bg-red-900/80`}
          >
            <IconDelete className="size-4" aria-hidden="true" />
          </button>
        </div>

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
        <div className="relative">
          {/* Placeholder : visible tant que la carte est vide, ne gêne pas le toucher (l'éditeur reste cliquable dessous) */}
          {isEmpty && (
            <p
              aria-hidden="true"
              className="pointer-events-none absolute left-[calc(0.75rem+1px)] right-3 top-[calc(0.5rem+1px)] font-serif italic leading-relaxed text-amber-200/35"
            >
              À compléter… écrivez directement ici (@ pour citer une fiche)
            </p>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}