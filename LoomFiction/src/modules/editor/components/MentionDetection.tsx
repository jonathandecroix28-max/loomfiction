import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { SheetResponse } from '../../../types/sheet';

export interface DetectionTarget {
  id: string | number;
  label: string;
  editor: Editor;
}

interface MentionDetectionProps {
  editor?: Editor;
  targets?: DetectionTarget[];
  sheets: SheetResponse[];
  onClose: () => void;
}

interface Match {
  from: number;
  to: number;
  text: string;
  options: SheetResponse[];
  selectedId: string;
  checked: boolean;
  targetId: string | number;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findMatches(editor: Editor, sheets: SheetResponse[], targetId: string | number): Match[] {
  const names = [...sheets]
    .filter((sheet) => sheet.name?.trim())
    .sort((a, b) => b.name.trim().length - a.name.trim().length);

  const raw: Array<{ from: number; to: number; text: string; sheet: SheetResponse }> = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;

    for (const sheet of names) {
      const name = sheet.name.trim();
      const regex = new RegExp(escapeRegExp(name), 'giu');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const before = start > 0 ? text[start - 1] : '';
        const after = end < text.length ? text[end] : '';
        const isWord = (char: string) => !!char && /[\p{L}\p{N}_]/u.test(char);

        if (isWord(before) || isWord(after)) continue;

        raw.push({
          from: pos + start,
          to: pos + end,
          text: match[0],
          sheet,
        });
      }
    }
  });

  raw.sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from));

  const selected: typeof raw = [];
  for (const item of raw) {
    const overlaps = selected.some((existing) =>
      item.from < existing.to && item.to > existing.from &&
      !(item.from === existing.from && item.to === existing.to)
    );
    if (!overlaps) selected.push(item);
  }

  const grouped = new Map<string, Match>();
  for (const item of selected) {
    const key = `${item.from}:${item.to}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.options.some((option) => String(option.id) === String(item.sheet.id))) {
        existing.options.push(item.sheet);
      }
    } else {
      grouped.set(key, {
        from: item.from,
        to: item.to,
        text: item.text,
        options: [item.sheet],
        selectedId: String(item.sheet.id),
        checked: true,
        targetId,
      });
    }
  }

  return [...grouped.values()].sort((a, b) => a.from - b.from);
}

export function MentionDetection({ editor, targets, sheets, onClose }: MentionDetectionProps) {
  const allTargets = useMemo<DetectionTarget[]>(
    () => targets ?? (editor ? [{ id: 'main', label: '', editor }] : []),
    [targets, editor]
  );
  const initialMatches = useMemo(
    () => allTargets.flatMap((target) => findMatches(target.editor, sheets, target.id)),
    [allTargets, sheets]
  );
  const [matches, setMatches] = useState(initialMatches);

  const selectedCount = matches.filter((match) => match.checked).length;

  useEffect(() => {
    allTargets.forEach((target) => target.editor.commands.blur());
  }, [allTargets]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const updateMatch = (index: number, patch: Partial<Match>) => {
    setMatches((current) => current.map((match, i) => i === index ? { ...match, ...patch } : match));
  };

  const convert = () => {
    const chosen = matches
      .filter((match) => match.checked)
      .map((match) => ({
        ...match,
        sheet: match.options.find((option) => String(option.id) === match.selectedId),
      }))
      .filter((match) => !!match.sheet)
      .sort((a, b) => b.from - a.from);

    if (!chosen.length) {
      onClose();
      return;
    }

    for (const target of allTargets) {
      const mine = chosen.filter((match) => match.targetId === target.id);
      if (mine.length === 0) continue;

      const chain = target.editor.chain();
      if (allTargets.length === 1) chain.focus();

      chain
        .command(({ tr, state }) => {
          const mentionType = state.schema.nodes.mention;
          if (!mentionType) return false;

          for (const match of mine) {
            tr.replaceWith(
              match.from,
              match.to,
              mentionType.create({
                id: String(match.sheet!.id),
                label: match.sheet!.name,
              }),
            );
          }
          return true;
        })
        .run();
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mention-detection-title"
        className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-amber-800/50 bg-[#211713] text-amber-50 shadow-2xl sm:max-h-[80dvh] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-900/40 px-4 py-3">
          <div>
            <h2 id="mention-detection-title" className="font-serif text-lg font-bold">Détecter les fiches</h2>
            <p className="font-sans text-xs text-amber-200/60">
              {matches.length} correspondance{matches.length > 1 ? 's' : ''} trouvée{matches.length > 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="min-h-10 shrink-0 cursor-pointer rounded-lg px-3 py-2 text-sm text-amber-200/70 hover:bg-white/5">Fermer</button>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
          {matches.length === 0 ? (
            <p className="rounded-xl bg-white/5 p-4 text-sm text-amber-100/70">
              {allTargets.length > 1 ? 'Aucune fiche trouvée dans les cartes.' : 'Aucune fiche trouvée dans ce texte.'}
            </p>
          ) : matches.map((match, index) => (
            <div key={`${match.targetId}-${match.from}-${match.to}`}>
              {allTargets.length > 1 && (index === 0 || matches[index - 1].targetId !== match.targetId) && (
                <p className="mb-1.5 mt-2 truncate font-sans text-[11px] font-semibold uppercase tracking-wider text-amber-200/50 first:mt-0">
                  {allTargets.find((target) => target.id === match.targetId)?.label}
                </p>
              )}
            <div className="rounded-xl border border-amber-900/40 bg-black/20 p-3">
              <label className="flex cursor-pointer items-start gap-3 py-0.5">
                <input
                  type="checkbox"
                  checked={match.checked}
                  onChange={(event) => updateMatch(index, { checked: event.target.checked })}
                  className="mt-0.5 size-5 shrink-0 accent-amber-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium text-amber-100">{match.text}</span>
                  <span className="block text-xs text-amber-200/50">
                    {match.options.length > 1 ? `${match.options.length} fiches portent ce nom` : 'Fiche correspondante'}
                  </span>
                </span>
              </label>

              {match.options.length > 1 && (
                <select
                  value={match.selectedId}
                  onChange={(event) => updateMatch(index, { selectedId: event.target.value })}
                  className="mt-3 min-h-11 w-full rounded-lg border border-amber-900/50 bg-[#160f0c] px-3 py-2 text-base text-amber-100 sm:min-h-0 sm:text-sm"
                  aria-label={`Choisir la fiche pour ${match.text}`}
                >
                  {match.options.map((option) => (
                    <option key={String(option.id)} value={String(option.id)}>
                      {option.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            </div>
          ))}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-amber-900/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-amber-200/60">{selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="min-h-11 flex-1 cursor-pointer rounded-xl border border-amber-900/50 px-4 py-2 text-sm text-amber-100/80 sm:min-h-0 sm:flex-none">Annuler</button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={convert}
              className="min-h-11 flex-1 cursor-pointer rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:flex-none"
            >
              Convertir la sélection
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}