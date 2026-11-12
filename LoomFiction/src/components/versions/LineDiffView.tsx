import {
  choiceLabels,
  choiceSummary,
  defaultChoice,
  isSideMissing,
  lineNumberOf,
  sideBg,
  type LineChoice,
  type LineChoices,
  type LineDiffRow,
} from '../../utils/versions/lineDiff';
import { displayLine } from '../../utils/versions/sanitizeHtml';
import { choiceBtn } from '../../utils/versions/versionStyles';

interface Props {
  rows: LineDiffRow[];
  choices: LineChoices;
  onChoose: (rowId: string, choice: LineChoice) => void;
  help: string;
  emptyMessage: string;
}

function renderSide(row: LineDiffRow, side: LineChoice) {
  if (isSideMissing(row, side)) return <span className="italic text-amber-200/30">absente</span>;
  const line = side === 'current' ? row.currentLine : row.versionLine;
  const text = displayLine(line);
  if (text === '') return <span className="italic text-amber-200/30">(ligne vide)</span>;
  return text;
}

export function LineDiffView({ rows, choices, onChoose, help, emptyMessage }: Props) {
  const renderChoice = (row: LineDiffRow) => {
    if (row.kind === 'equal') return <span className="text-xs text-emerald-300">Identique</span>;

    const selected = choices[row.id] ?? defaultChoice(row);
    const labels = choiceLabels(row.kind);
    const activeLine = selected === 'version' ? row.versionLine : row.currentLine;

    return (
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] sm:text-xs text-amber-200/50">Résultat : {choiceSummary(row.kind, selected)}</div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={() => onChoose(row.id, 'current')}
            className={`${choiceBtn(selected === 'current')} flex-1 px-1 sm:px-2 py-2 text-[11px] sm:text-xs text-center justify-center`}
          >
            {labels.current}
          </button>
          <button
            onClick={() => onChoose(row.id, 'version')}
            className={`${choiceBtn(selected === 'version')} flex-1 px-1 sm:px-2 py-2 text-[11px] sm:text-xs text-center justify-center`}
          >
            {labels.version}
          </button>
        </div>
        <div className="mt-1 p-2 sm:p-2.5 rounded-lg bg-neutral-900/40 border border-amber-900/10 text-[11px] sm:text-xs text-amber-100/90 whitespace-pre-wrap wrap-break-word">
          {(activeLine && displayLine(activeLine)) || <span className="italic text-amber-200/30">— Ligne vide —</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl sm:rounded-2xl border border-amber-900/20 bg-neutral-950/60 p-3 sm:p-5 space-y-3">
      <div>
        <div className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40 mb-1">Diff ligne par ligne</div>
        <p className="text-xs sm:text-sm text-amber-200/60">{help}</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-amber-200/50 text-sm">{emptyMessage}</div>
      ) : (
        <>
          {/* Mobile : une carte par ligne */}
          <ul className="md:hidden max-h-[50vh] overflow-y-auto space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`rounded-xl border border-amber-900/20 p-3 space-y-3 ${row.kind === 'equal' ? 'bg-neutral-950/35' : 'bg-neutral-950/70'}`}
              >
                <div className="flex items-center justify-between text-[11px] font-sans font-medium uppercase tracking-widest text-amber-200/40">
                  <span>Ligne {lineNumberOf(row)}</span>
                  {row.kind === 'equal' && <span className="text-emerald-300">Identique</span>}
                </div>
                
                {row.kind === 'equal' ? (
                  <div className="text-sm text-amber-100/80 whitespace-pre-wrap wrap-break-word">{renderSide(row, 'current')}</div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2.5">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-amber-200/30 mb-1">Actuel</div>
                        <div className={`rounded-md px-2.5 py-2 text-sm text-amber-100/80 whitespace-pre-wrap wrap-break-word ${sideBg(row, 'current')}`}>
                          {renderSide(row, 'current')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-amber-200/30 mb-1">Version</div>
                        <div className={`rounded-md px-2.5 py-2 text-sm text-amber-100/80 whitespace-pre-wrap wrap-break-word ${sideBg(row, 'version')}`}>
                          {renderSide(row, 'version')}
                        </div>
                      </div>
                    </div>
                    {renderChoice(row)}
                  </>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop : tableau */}
          <div className="hidden md:block max-h-[45vh] overflow-auto rounded-2xl border border-amber-900/20">
            <table className="min-w-full divide-y divide-amber-900/10">
              <thead className="bg-neutral-950/90 sticky top-0 z-10">
                <tr className="text-left text-xs uppercase tracking-[0.22em] text-amber-200/40">
                  <th className="px-4 py-3 font-medium">Ligne</th>
                  <th className="px-4 py-3 font-medium">Actuel</th>
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium w-64">Choix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-900/10">
                {rows.map((row) => (
                  <tr key={row.id} className={row.kind === 'equal' ? 'bg-neutral-950/35' : 'bg-neutral-950/55'}>
                    <td className="px-4 py-3 align-top text-xs text-amber-200/40 whitespace-nowrap">{lineNumberOf(row)}</td>
                    <td className={`px-4 py-3 align-top whitespace-pre-wrap wrap-break-word text-sm text-amber-100/80 ${sideBg(row, 'current')}`}>
                      {renderSide(row, 'current')}
                    </td>
                    <td className={`px-4 py-3 align-top whitespace-pre-wrap wrap-break-word text-sm text-amber-100/80 ${sideBg(row, 'version')}`}>
                      {renderSide(row, 'version')}
                    </td>
                    <td className="px-4 py-3 align-top">{renderChoice(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}