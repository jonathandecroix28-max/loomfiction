import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CompareMode } from '../../hooks/versions/useVersionCompare';
import {
  choiceLabels,
  choiceSummary,
  defaultChoice,
  isSideMissing,
  lineNumberOf,
  type LineChoice,
  type LineChoices,
  type LineDiffRow,
} from '../../utils/versions/lineDiff';
import { displayLine } from '../../utils/versions/sanitizeHtml';
import { wordDiff, type Seg } from '../diff/diffRows';
import '../diff/diff.css';

type Tone = 'add' | 'del';

interface Props {
  rows: LineDiffRow[];
  choices: LineChoices;
  onChoose: (rowId: string, choice: LineChoice) => void;
  help: string;
  emptyMessage: string;
  mode?: CompareMode;
  sideLabels?: Record<LineChoice, string>;
  tones?: Record<LineChoice, Tone>;
}

const DEFAULT_LABELS: Record<LineChoice, string> = { current: 'Actuel', version: 'Version' };
const DEFAULT_TONES: Record<LineChoice, Tone> = { current: 'add', version: 'del' };
const MIN_WORD_RATIO = 0.2;

const textOf = (row: LineDiffRow, side: LineChoice) => displayLine(side === 'current' ? row.currentLine : row.versionLine);

function renderSegs(segs: Seg[]): ReactNode {
  return segs.map((seg, index) =>
    seg.changed ? (
      <span key={index} className="ld-w">
        {seg.text}
      </span>
    ) : (
      <Fragment key={index}>{seg.text}</Fragment>
    ),
  );
}

export function LineDiffView({
  rows,
  choices,
  onChoose,
  help,
  emptyMessage,
  mode = 'current-left',
  sideLabels = DEFAULT_LABELS,
  tones = DEFAULT_TONES,
}: Props) {
  const sides: LineChoice[] = mode === 'current-left' ? ['current', 'version'] : ['version', 'current'];

  const wordSegs = useMemo(() => {
    const map = new Map<string, Record<LineChoice, Seg[]>>();
    for (const row of rows) {
      if (row.kind === 'equal' || isSideMissing(row, 'current') || isSideMissing(row, 'version')) continue;
      const oldSide: LineChoice = tones.current === 'del' ? 'current' : 'version';
      const newSide: LineChoice = oldSide === 'current' ? 'version' : 'current';
      const diff = wordDiff(textOf(row, oldSide), textOf(row, newSide));
      if (!diff || diff.ratio < MIN_WORD_RATIO) continue;
      map.set(row.id, { [oldSide]: diff.left, [newSide]: diff.right } as Record<LineChoice, Seg[]>);
    }
    return map;
  }, [rows, tones.current]);

  const renderText = (row: LineDiffRow, side: LineChoice): ReactNode => {
    if (isSideMissing(row, side)) return <span className="ld-italic">absente</span>;
    const segs = wordSegs.get(row.id)?.[side];
    if (segs) return renderSegs(segs);
    const text = textOf(row, side);
    return text === '' ? <span className="ld-italic">(ligne vide)</span> : text;
  };

  const renderCell = (row: LineDiffRow, side: LineChoice, position?: 'l' | 'r') => {
    const sideClass = position === 'r' ? 'ld-r' : '';

    if (row.kind === 'equal') {
      return (
        <div className={`ld-cell ld-eq ${sideClass}`}>
          <span className="ld-num">{lineNumberOf(row)}</span>
          <span className="ld-rail" aria-hidden="true" />
          <span className="ld-mark" aria-hidden="true" />
          <span className="ld-text">{renderText(row, side)}</span>
        </div>
      );
    }

    const tone = tones[side];
    const missing = isSideMissing(row, side);
    const selected = (choices[row.id] ?? defaultChoice(row)) === side;
    const labels = choiceLabels(row.kind);

    return (
      <button
        type="button"
        onClick={() => onChoose(row.id, side)}
        aria-pressed={selected}
        title={`${labels[side]} — ${choiceSummary(row.kind, side)}`}
        data-pick={selected ? 'kept' : 'dropped'}
        className={`ld-cell ld-pickcell ld-${tone} ${missing ? 'ld-empty' : ''} ${sideClass}`}
      >
        <span className="ld-num">{lineNumberOf(row)}</span>
        <span className="ld-rail" aria-hidden="true" />
        <span className="ld-mark" aria-hidden="true">
          {missing ? '' : tone === 'del' ? '−' : '+'}
        </span>
        <span className="ld-text">
          <span className="sr-only">{labels[side]} : </span>
          {renderText(row, side)}
          {selected && <span className="ld-kept">✓ gardé</span>}
        </span>
      </button>
    );
  };

  return (
    <section className="loom-diff overflow-hidden rounded-xl border border-amber-900/25 bg-neutral-950/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/20 px-4 py-3 font-sans">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/40">Diff ligne par ligne</div>
          <p className="mt-0.5 text-xs text-amber-200/60">{help}</p>
        </div>
        <span className="text-[11px] text-amber-200/50">Cliquez sur un côté pour le garder</span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center font-sans text-sm text-amber-200/50">{emptyMessage}</div>
      ) : (
        <div className="ld-body max-h-[50vh] overflow-y-auto">
          {/* Ordinateur : deux colonnes, une rangée = une ligne */}
          <div className="hidden md:block">
            <div className="ld-head ld-row">
              {sides.map((side, index) => (
                <div key={side} className={`ld-tab ld-tab-${tones[side]} ${index === 1 ? 'ld-r' : ''}`}>
                  <span className="truncate">{sideLabels[side]}</span>
                </div>
              ))}
            </div>
            {rows.map((row) => (
              <div key={row.id} className="ld-row">
                {renderCell(row, sides[0], 'l')}
                {renderCell(row, sides[1], 'r')}
              </div>
            ))}
          </div>

          {/* Mobile : un côté sous l’autre */}
          <div className="md:hidden">
            {rows.map((row) => (
              <div key={row.id} className="ld-mrow">
                {row.kind === 'equal' ? (
                  renderCell(row, 'current')
                ) : (
                  sides.map((side) => (
                    <div key={side}>
                      <span className={`ld-lbl ld-lbl-${tones[side]}`}>
                        {sideLabels[side]} · ligne {lineNumberOf(row)}
                      </span>
                      {renderCell(row, side)}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}