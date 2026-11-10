import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { createPortal } from 'react-dom';
import { useConfirm, useToast } from '../../../components/feedback/FeedbackProvider';
import { anchorFor, applyHighlights, clearHighlights, resolveAnnotations } from '../utils/anchors';
import { newAnnotationId } from '../utils/annotationStore';
import { AnnotationSheet } from './AnnotationSheet';
import { MarginNotes, type MarginNoteItem } from './MarginNotes';
import { NotesDrawer, IconNotes, type NotesDrawerItem } from './NotesDrawer';
import { QuoteCardModal } from './QuoteCardModal';
import { SelectionToolbar } from './SelectionToolbar';
import { stopBubbling } from '../utils/stopBubbling';
import type { Annotation, HighlightColor } from '../utils/types';
import { useAnnotations } from '../hooks/useAnnotations';
import { useTextSelection } from '../hooks/useTextSelection';

interface AnnotatedChapterProps {
  html: string;
  chapterId: number;
  bookId: number | null;
  bookTitle: string;
  chapterTitle?: string;
  authorName?: string;
  className?: string;
  marginNotes?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

interface SheetState {
  id: string;
  focusNote: boolean;
}

const SANITIZE = { ADD_ATTR: ['data-type', 'data-id', 'data-label'] };

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);
const sameNumbers = (a: Record<string, number>, b: Record<string, number>) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

export function AnnotatedChapter({
  html,
  chapterId,
  bookId,
  bookTitle,
  chapterTitle,
  authorName,
  className,
  marginNotes = true,
  onBusyChange,
}: AnnotatedChapterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const { annotations, add, update, remove } = useAnnotations(chapterId);
  const selection = useTextSelection(rootRef);

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});
  // Ordre de lecture des annotations et numéro de chaque note : c'est ce qui permet de s'y retrouver
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [noteNumbers, setNoteNumbers] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);

  const sanitized = useMemo(() => DOMPurify.sanitize(html, SANITIZE), [html]);

  const busy = selection !== null || sheet !== null || quoteText !== null || drawerOpen;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root) root.innerHTML = sanitized;
  }, [sanitized]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    clearHighlights(root);
    applyHighlights(root, resolveAnnotations(root.textContent ?? '', annotations));

    const byId = new Map(annotations.map((annotation) => [annotation.id, annotation]));
    const order: string[] = [];
    const numbers: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>('mark.annot').forEach((mark) => {
      delete mark.dataset.note;
      const id = mark.dataset.annotationId;
      if (!id || order.includes(id)) return;

      order.push(id);
      if (byId.get(id)?.note.trim()) {
        numbers[id] = Object.keys(numbers).length + 1;
        mark.dataset.note = String(numbers[id]);
      }
    });
    setOrderedIds((previous) => (sameList(previous, order) ? previous : order));
    setNoteNumbers((previous) => (sameNumbers(previous, numbers) ? previous : numbers));
  }, [sanitized, annotations]);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  useEffect(() => {
    rootRef.current?.querySelectorAll<HTMLElement>('mark.annot').forEach((mark) => {
      if (mark.dataset.annotationId === hoverId) mark.dataset.active = 'true';
      else delete mark.dataset.active;
    });
  }, [hoverId, annotations, sanitized]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !marginNotes) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const base = root.getBoundingClientRect().top;
      const next: Record<string, number> = {};
      for (const annotation of annotations) {
        if (!annotation.note.trim()) continue;
        const mark = root.querySelector<HTMLElement>(`mark.annot[data-annotation-id="${annotation.id}"]`);
        if (mark) next[annotation.id] = mark.getBoundingClientRect().top - base;
      }
      setPositions(next);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [annotations, sanitized, marginNotes]);

  const noteItems = useMemo<MarginNoteItem[]>(
    () =>
      annotations
        .filter((annotation) => annotation.note.trim() && positions[annotation.id] !== undefined)
        .map((annotation) => ({ annotation, top: positions[annotation.id] })),
    [annotations, positions],
  );

  const goToAnnotation = (id: string, block: ScrollLogicalPosition = 'center') => {
    const marks = rootRef.current?.querySelectorAll<HTMLElement>(`mark.annot[data-annotation-id="${id}"]`);
    const first = marks?.[0];
    if (!marks || !first) return;

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    first.scrollIntoView({ block, behavior: calm ? 'auto' : 'smooth' });

    marks.forEach((mark) => {
      mark.dataset.flash = 'true';
    });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      marks.forEach((mark) => {
        delete mark.dataset.flash;
      });
    }, 1600);
  };

  const persist = (ok: boolean) => {
    if (!ok) toast.error('Impossible d’enregistrer l’annotation (stockage plein ou désactivé).');
  };

  const copyQuote = async (text: string) => {
    const source = [bookTitle, chapterTitle].filter(Boolean).join(', ');
    try {
      await navigator.clipboard.writeText(`«\u00a0${text}\u00a0»\n— ${source}`);
      toast.success('Citation copiée');
    } catch {
      toast.error('Copie impossible : autorisez l’accès au presse-papiers.');
    }
  };

  const highlightSelection = (color: HighlightColor, openNote: boolean) => {
    if (!selection) return;
    const now = new Date().toISOString();
    const annotation: Annotation = {
      id: newAnnotationId(),
      chapterId,
      bookId,
      start: selection.start,
      end: selection.end,
      ...anchorFor(rootRef.current?.textContent ?? '', selection.start, selection.end),
      quote: selection.quote,
      color,
      note: '',
      createdAt: now,
      updatedAt: now,
    };
    persist(add(annotation));
    window.getSelection()?.removeAllRanges();
    if (openNote) setSheet({ id: annotation.id, focusNote: true });
  };

  const openFromEvent = (target: EventTarget | null) => {
    const mark = (target as HTMLElement | null)?.closest<HTMLElement>('mark.annot');
    const id = mark?.dataset.annotationId;
    if (!id) return false;
    setSheet({ id, focusNote: false });
    return true;
  };

  const sheetAnnotation = sheet ? annotations.find((item) => item.id === sheet.id) : undefined;
  const sheetIndex = sheet ? orderedIds.indexOf(sheet.id) : -1;

  const openNeighbor = (id: string) => {
    setSheet({ id, focusNote: false });
    goToAnnotation(id, 'start');
  };

  const drawerItems = useMemo<NotesDrawerItem[]>(() => {
    const byId = new Map(annotations.map((annotation) => [annotation.id, annotation]));
    const found = orderedIds.flatMap((id) => {
      const annotation = byId.get(id);
      return annotation ? [{ annotation, number: noteNumbers[id] }] : [];
    });
    const lost = annotations.filter((annotation) => !orderedIds.includes(annotation.id)).map((annotation) => ({ annotation, missing: true }));
    return [...found, ...lost];
  }, [annotations, orderedIds, noteNumbers]);

  const deleteAnnotation = async (annotation: Annotation) => {
    if (annotation.note.trim()) {
      const ok = await confirm({
        title: 'Supprimer cette annotation ?',
        message: 'Le surlignage et sa note de marge seront supprimés.',
        tone: 'danger',
      });
      if (!ok) return;
    }
    persist(remove(annotation.id));
    setSheet(null);
  };

  return (
    <div
      className="relative"
      onMouseOver={(event) => {
        const id = (event.target as HTMLElement).closest<HTMLElement>('mark.annot')?.dataset.annotationId;
        if (id) setHoverId(id);
      }}
      onMouseOut={(event) => {
        if ((event.target as HTMLElement).closest('mark.annot')) setHoverId(null);
      }}
      onClick={(event) => {
        if (window.getSelection()?.isCollapsed) openFromEvent(event.target);
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && openFromEvent(event.target)) event.preventDefault();
      }}
    >
      <div ref={rootRef} className={className} />

      {marginNotes && <MarginNotes items={noteItems} numbers={noteNumbers} hoverId={hoverId} onHover={setHoverId} onOpen={(id) => setSheet({ id, focusNote: false })} />}

      {selection && !sheet && quoteText === null && (
        <SelectionToolbar
          selection={selection}
          onHighlight={(color) => highlightSelection(color, false)}
          onNote={() => highlightSelection('amber', true)}
          onQuoteCard={() => {
            setQuoteText(selection.quote);
            window.getSelection()?.removeAllRanges();
          }}
          onCopy={() => {
            void copyQuote(selection.quote);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}

      {sheetAnnotation && sheet && (
        <AnnotationSheet
          key={sheetAnnotation.id}
          annotation={sheetAnnotation}
          autoFocusNote={sheet.focusNote}
          noteNumber={noteNumbers[sheetAnnotation.id]}
          position={sheetIndex >= 0 ? { index: sheetIndex + 1, total: orderedIds.length } : undefined}
          onPrev={sheetIndex > 0 ? () => openNeighbor(orderedIds[sheetIndex - 1]) : undefined}
          onNext={sheetIndex >= 0 && sheetIndex < orderedIds.length - 1 ? () => openNeighbor(orderedIds[sheetIndex + 1]) : undefined}
          onChange={(patch) => persist(update(sheetAnnotation.id, patch))}
          onDelete={() => void deleteAnnotation(sheetAnnotation)}
          onQuoteCard={() => setQuoteText(sheetAnnotation.quote)}
          onCopy={() => void copyQuote(sheetAnnotation.quote)}
          onClose={() => setSheet(null)}
        />
      )}

      {/* Mobile et tablette : la marge n'a pas la place de s'afficher, on ouvre la liste des annotations */}
      {marginNotes &&
        annotations.length > 0 &&
        !busy &&
        createPortal(
          <button
            type="button"
            {...stopBubbling}
            onClick={() => setDrawerOpen(true)}
            aria-label={`Ouvrir les annotations du chapitre (${annotations.length})`}
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-[60] flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-amber-900/40 bg-neutral-950 px-4 font-sans text-sm font-medium text-amber-100 shadow-2xl transition hover:bg-neutral-900 xl:hidden print:hidden"
          >
            <IconNotes className="size-5" />
            Annotations
            <span className="flex min-w-6 items-center justify-center rounded-full bg-amber-700 px-1.5 py-0.5 text-xs font-bold text-amber-50">
              {annotations.length}
            </span>
          </button>,
          document.body,
        )}

      {drawerOpen && (
        <NotesDrawer
          items={drawerItems}
          onClose={() => setDrawerOpen(false)}
          onGo={(id) => {
            setDrawerOpen(false);
            window.setTimeout(() => goToAnnotation(id), 60);
          }}
          onEdit={(id) => {
            setDrawerOpen(false);
            setSheet({ id, focusNote: true });
          }}
        />
      )}

      {quoteText !== null && (
        <QuoteCardModal
          quote={quoteText}
          bookTitle={bookTitle}
          chapterTitle={chapterTitle}
          authorName={authorName}
          onClose={() => setQuoteText(null)}
        />
      )}
    </div>
  );
}