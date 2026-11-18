import { Fragment, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { buildRows, type Cell, type DiffRowData, type DRow } from './diffRows';



export interface DiffViewProps {
  rows: DiffRowData[];
  changeIds: number[];
  decisions: Record<number, boolean>;
  onDecide: (changeId: number, accepted: boolean) => void;
  hideIdentical: boolean;
  onHideIdenticalChange: (hide: boolean) => void;
  onPreview: () => void;
  oldLabel: string;
  oldBadge?: string;
  currentLabel: string;
  currentBadge?: string;
}

type DecisionState = 'pending' | 'accepted' | 'rejected';
type Item =
  | { t: 'hunk'; id: number; index: number; del: number; add: number }
  | { t: 'fold'; key: string; count: number; open: boolean }
  | { t: 'row'; row: DRow };

const CSS = `
.loom-diff{
  --add:96 182 132;
  --del:229 114 102;
  --thread:var(--c-text-2);
  --ed:color-mix(in srgb,var(--c-page) 72%,black);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
html.sunrise-mode .loom-diff{
  --add:24 116 78;
  --del:172 48 42;
  --ed:color-mix(in srgb,var(--c-surface) 72%,var(--c-page));
}

/* Zone de code : fond d’éditeur, fils de chaîne très discrets */
.loom-diff .ld-body{
  background-color:var(--ed);
  background-image:repeating-linear-gradient(90deg,color-mix(in srgb,var(--thread) 4%,transparent) 0 1px,transparent 1px 14px);
}

/* Onglets de colonne */
.loom-diff .ld-head{position:sticky;top:0;z-index:10}
.loom-diff .ld-tab{
  display:flex;align-items:center;justify-content:space-between;gap:.5rem;min-width:0;
  padding:.55rem 1rem;background:var(--c-surface);color:var(--c-text-2);
  border-top:2px solid transparent;border-bottom:1px solid color-mix(in srgb,var(--thread) 22%,transparent);
  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:.75rem;
}
.loom-diff .ld-tab-del{border-top-color:rgb(var(--del)/.85)}
.loom-diff .ld-tab-add{border-top-color:rgb(var(--add)/.85)}
.loom-diff .ld-badge{flex-shrink:0;border-radius:999px;padding:.1rem .55rem;font-size:.625rem;letter-spacing:.04em;text-transform:uppercase}
.loom-diff .ld-badge-del{background:rgb(var(--del)/.16);color:rgb(var(--del))}
.loom-diff .ld-badge-add{background:rgb(var(--add)/.16);color:rgb(var(--add))}

/* Rangées */
.loom-diff .ld-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.loom-diff .ld-cell{
  position:relative;display:grid;grid-template-columns:2.75rem 1.25rem 1.25rem minmax(0,1fr);
  min-height:1.75rem;font-size:13px;line-height:1.55rem;
}
.loom-diff .ld-r{border-left:1px solid color-mix(in srgb,var(--thread) 18%,transparent)}
.loom-diff .ld-num{
  padding-right:.5rem;text-align:right;user-select:none;font-variant-numeric:tabular-nums;
  color:color-mix(in srgb,var(--thread) 55%,transparent);
}
.loom-diff .ld-rail{position:relative}
.loom-diff .ld-rail::before{
  content:"";position:absolute;left:50%;top:0;bottom:0;width:1px;transform:translateX(-50%);
  background:color-mix(in srgb,var(--thread) 30%,transparent);
}
.loom-diff .ld-mark{text-align:center;font-weight:700;user-select:none}
.loom-diff .ld-text{
  padding:0 .75rem 0 .25rem;white-space:pre-wrap;overflow-wrap:anywhere;
  color:color-mix(in srgb,var(--c-ink) 92%,transparent);
}
.loom-diff .ld-eq .ld-text{color:color-mix(in srgb,var(--c-ink) 68%,transparent)}

/* Fils modifiés : rail épaissi et teinté, fond léger */
.loom-diff .ld-del{background:rgb(var(--del)/.10)}
.loom-diff .ld-add{background:rgb(var(--add)/.10)}
.loom-diff .ld-del .ld-rail::before{width:3px;border-radius:2px;background:rgb(var(--del))}
.loom-diff .ld-add .ld-rail::before{width:3px;border-radius:2px;background:rgb(var(--add))}
.loom-diff .ld-del .ld-mark{color:rgb(var(--del))}
.loom-diff .ld-add .ld-mark{color:rgb(var(--add))}
.loom-diff .ld-del .ld-w{background:rgb(var(--del)/.30);border-radius:3px;box-shadow:0 0 0 1px rgb(var(--del)/.16)}
.loom-diff .ld-add .ld-w{background:rgb(var(--add)/.30);border-radius:3px;box-shadow:0 0 0 1px rgb(var(--add)/.16)}

/* Côté absent : hachures, comme un fil qui n’existe pas de ce côté */
.loom-diff .ld-empty{
  background-image:repeating-linear-gradient(135deg,transparent 0 6px,color-mix(in srgb,var(--thread) 11%,transparent) 6px 7px);
}

/* Décision : le fil écarté s’estompe */
.loom-diff [data-d="accepted"] .ld-del,
.loom-diff [data-d="rejected"] .ld-add{opacity:.4}

/* Barre de changement : nœud + couture */
.loom-diff .ld-hunk{
  display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;scroll-margin-top:3rem;
  padding:.4rem .75rem;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:.75rem;color:var(--c-text-2);
  background:color-mix(in srgb,var(--c-surface) 78%,transparent);
  border-block:1px solid color-mix(in srgb,var(--thread) 22%,transparent);
}
.loom-diff .ld-knot{
  flex-shrink:0;width:.8rem;height:.8rem;border-radius:999px;border:2px solid var(--c-a500);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--c-surface) 78%,transparent);
}
.loom-diff [data-d="accepted"] > .ld-knot{background:rgb(var(--add));border-color:rgb(var(--add))}
.loom-diff [data-d="rejected"] > .ld-knot{background:rgb(var(--del));border-color:rgb(var(--del))}
.loom-diff .ld-stitch{flex:1 1 1rem;min-width:.75rem;border-top:2px dashed color-mix(in srgb,var(--thread) 32%,transparent)}
.loom-diff .ld-del-t{color:rgb(var(--del))}
.loom-diff .ld-add-t{color:rgb(var(--add))}
.loom-diff .ld-btn{
  min-height:2.5rem;padding:0 .8rem;cursor:pointer;border-radius:.5rem;font:inherit;font-weight:500;
  color:var(--c-text-2);background:var(--c-surface-2);border:1px solid color-mix(in srgb,var(--thread) 30%,transparent);
  transition:background-color .15s,border-color .15s,color .15s;
}
.loom-diff .ld-btn:hover{background:var(--c-surface-3);color:var(--c-heading)}
.loom-diff .ld-btn[data-on="true"].ld-yes{background:rgb(var(--add)/.2);border-color:rgb(var(--add));color:rgb(var(--add))}
.loom-diff .ld-btn[data-on="true"].ld-no{background:rgb(var(--del)/.2);border-color:rgb(var(--del));color:rgb(var(--del))}
@media (min-width:768px){.loom-diff .ld-btn{min-height:2rem}}
@media (max-width:640px){.loom-diff .ld-stitch{display:none}}

/* Lignes identiques repliées */
.loom-diff .ld-fold{
  display:flex;width:100%;align-items:center;gap:.75rem;padding:.3rem .75rem;cursor:pointer;
  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:.6875rem;color:color-mix(in srgb,var(--thread) 70%,transparent);
  background:color-mix(in srgb,var(--c-surface) 40%,transparent);
}
.loom-diff .ld-fold:hover{color:var(--c-heading)}

/* Fil des changements (navigation) */
.loom-diff .ld-beads{display:flex;align-items:center;overflow-x:auto;padding:.1rem 0}
.loom-diff .ld-bead-link{flex-shrink:0;width:.9rem;border-top:2px dashed color-mix(in srgb,var(--thread) 35%,transparent)}
.loom-diff .ld-bead{
  flex-shrink:0;width:1.75rem;height:1.75rem;cursor:pointer;border-radius:999px;font-size:.6875rem;
  border:2px solid var(--c-a500);background:transparent;color:var(--c-text-2);
}
.loom-diff .ld-bead[data-d="accepted"]{background:rgb(var(--add));border-color:rgb(var(--add));color:var(--c-page)}
.loom-diff .ld-bead[data-d="rejected"]{background:rgb(var(--del));border-color:rgb(var(--del));color:var(--c-page)}

/* Interrupteur « masquer les lignes identiques » */
.loom-diff .ld-switch{
  position:relative;flex-shrink:0;width:2.25rem;height:1.25rem;border-radius:999px;
  background:var(--c-surface-2);border:1px solid color-mix(in srgb,var(--thread) 35%,transparent);transition:background-color .15s;
}
.loom-diff .ld-switch::after{
  content:"";position:absolute;top:2px;left:2px;width:.875rem;height:.875rem;border-radius:999px;
  background:var(--c-text-2);transition:transform .15s;
}
.loom-diff input:checked + .ld-switch{background:var(--c-a700);border-color:var(--c-a700)}
.loom-diff input:checked + .ld-switch::after{transform:translateX(1rem);background:var(--c-a50)}
.loom-diff input:focus-visible + .ld-switch{outline:2px solid var(--c-a500);outline-offset:2px}

@media (prefers-reduced-motion: reduce){
  .loom-diff *{transition:none!important}
}
`;

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const STATE_LABEL: Record<DecisionState, string> = {
  pending: 'En attente',
  accepted: 'Accepté',
  rejected: 'Rejeté',
};

function renderText(cell: Cell): ReactNode {
  if (!cell.segs) return cell.text || ' ';
  return cell.segs.map((seg, index) =>
    seg.changed ? (
      <span key={index} className="ld-w">
        {seg.text}
      </span>
    ) : (
      <Fragment key={index}>{seg.text}</Fragment>
    ),
  );
}

function CellView({ cell, tone, side }: { cell: Cell | null; tone: 'eq' | 'del' | 'add'; side?: 'l' | 'r' }) {
  const sideClass = side === 'r' ? 'ld-r' : '';
  if (!cell) return <div className={`ld-cell ld-empty ${sideClass}`} aria-hidden="true" />;
  return (
    <div className={`ld-cell ld-${tone} ${sideClass}`}>
      <span className="ld-num">{cell.line ?? ''}</span>
      <span className="ld-rail" aria-hidden="true" />
      <span className="ld-mark" aria-hidden="true">
        {tone === 'del' ? '−' : tone === 'add' ? '+' : ''}
      </span>
      <span className="ld-text">
        {tone !== 'eq' && <span className="sr-only">{tone === 'del' ? 'Supprimé : ' : 'Ajouté : '}</span>}
        {renderText(cell)}
      </span>
    </div>
  );
}

export function DiffView({
  rows,
  changeIds,
  decisions,
  onDecide,
  hideIdentical,
  onHideIdenticalChange,
  onPreview,
  oldLabel,
  oldBadge = 'Ancienne version',
  currentLabel,
  currentBadge = 'Actuel',
}: DiffViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const bodyRef = useRef<HTMLDivElement>(null);

  const dRows = useMemo(() => buildRows(rows), [rows]);

  const stats = useMemo(() => {
    const map = new Map<number, { del: number; add: number }>();
    for (const row of rows) {
      if (row.hunkId === null || row.type === 'equal') continue;
      const entry = map.get(row.hunkId) ?? { del: 0, add: 0 };
      if (row.type === 'removed') entry.del++;
      else entry.add++;
      map.set(row.hunkId, entry);
    }
    return map;
  }, [rows]);

  const items = useMemo(() => {
    const result: Item[] = [];
    const seen = new Set<number>();
    let k = 0;
    while (k < dRows.length) {
      const row = dRows[k];
      if (row.equal && hideIdentical) {
        let end = k;
        while (end < dRows.length && dRows[end].equal) end++;
        const open = expanded.has(row.key);
        result.push({ t: 'fold', key: row.key, count: end - k, open });
        if (open) for (let q = k; q < end; q++) result.push({ t: 'row', row: dRows[q] });
        k = end;
        continue;
      }
      if (!row.equal && row.hunkId !== null && !seen.has(row.hunkId)) {
        const entry = stats.get(row.hunkId) ?? { del: 0, add: 0 };
        result.push({ t: 'hunk', id: row.hunkId, index: seen.size, del: entry.del, add: entry.add });
        seen.add(row.hunkId);
      }
      result.push({ t: 'row', row });
      k++;
    }
    return result;
  }, [dRows, hideIdentical, expanded, stats]);

  const stateOf = (id: number | null): DecisionState =>
    id === null || decisions[id] === undefined ? 'pending' : decisions[id] ? 'accepted' : 'rejected';

  const decidedCount = changeIds.filter((id) => decisions[id] !== undefined).length;

  const toggleFold = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const jumpTo = (id: number) => {
    const targets = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>(`[data-hunk="${id}"]`) ?? []);
    const visible = targets.find((element) => element.offsetParent !== null);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    visible?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  };

  const hunkBar = (item: Extract<Item, { t: 'hunk' }>, prefix: string) => {
    const state = stateOf(item.id);
    return (
      <div key={`${prefix}h${item.id}`} className="ld-hunk" data-hunk={item.id} data-d={state}>
        <span className="ld-knot" aria-hidden="true" />
        <span className="font-medium text-amber-100">Changement {item.index + 1}</span>
        <span className="tabular-nums">
          <span className="ld-del-t">−{item.del}</span> <span className="ld-add-t">+{item.add}</span>
        </span>
        <span className="ld-stitch" aria-hidden="true" />
        <span className="text-[11px] text-amber-200/60">{STATE_LABEL[state]}</span>
        <button
          type="button"
          className="ld-btn ld-yes"
          data-on={state === 'accepted'}
          aria-pressed={state === 'accepted'}
          title="Garder la modification (version actuelle)"
          onClick={() => onDecide(item.id, true)}
        >
          Accepter
        </button>
        <button
          type="button"
          className="ld-btn ld-no"
          data-on={state === 'rejected'}
          aria-pressed={state === 'rejected'}
          title="Revenir au texte de l’ancienne version"
          onClick={() => onDecide(item.id, false)}
        >
          Rejeter
        </button>
      </div>
    );
  };

  const foldBar = (item: Extract<Item, { t: 'fold' }>, prefix: string) => (
    <button
      key={`${prefix}f${item.key}`}
      type="button"
      className="ld-fold"
      aria-expanded={item.open}
      onClick={() => toggleFold(item.key)}
    >
      <span className="ld-stitch" aria-hidden="true" />
      <span>
        {item.open
          ? `Replier ${plural(item.count, 'ligne identique', 'lignes identiques')}`
          : `${plural(item.count, 'ligne identique masquée', 'lignes identiques masquées')} · afficher`}
      </span>
      <span className="ld-stitch" aria-hidden="true" />
    </button>
  );

  const desktopItem = (item: Item) => {
    if (item.t === 'hunk') return hunkBar(item, 'd');
    if (item.t === 'fold') return foldBar(item, 'd');
    const { row } = item;
    return (
      <div key={`d${row.key}`} className="ld-row" data-d={row.equal ? undefined : stateOf(row.hunkId)}>
        <CellView cell={row.left} tone={row.equal ? 'eq' : 'del'} side="l" />
        <CellView cell={row.right} tone={row.equal ? 'eq' : 'add'} side="r" />
      </div>
    );
  };

  const mobileItem = (item: Item) => {
    if (item.t === 'hunk') return hunkBar(item, 'm');
    if (item.t === 'fold') return foldBar(item, 'm');
    const { row } = item;
    const d = row.equal ? undefined : stateOf(row.hunkId);
    if (row.equal) {
      return (
        <div key={`m${row.key}`}>
          <CellView cell={row.right ?? row.left} tone="eq" />
        </div>
      );
    }
    return (
      <div key={`m${row.key}`} data-d={d}>
        {row.left && <CellView cell={row.left} tone="del" />}
        {row.right && <CellView cell={row.right} tone="add" />}
      </div>
    );
  };

  return (
    <main className="loom-diff flex min-h-0 flex-1 flex-col overflow-hidden text-xs sm:text-sm">
      <style>{CSS}</style>

      {/* Barre d’outils */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-amber-900/30 bg-neutral-950 px-3 py-2 font-sans sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-amber-200/80">
            <input
              type="checkbox"
              className="sr-only"
              checked={hideIdentical}
              onChange={(event) => onHideIdenticalChange(event.target.checked)}
            />
            <span className="ld-switch" aria-hidden="true" />
            Masquer les lignes identiques
          </label>
          <span className="shrink-0 text-[11px] text-amber-200/60">
            {changeIds.length === 0 ? 'Aucun changement' : plural(changeIds.length, 'changement', 'changements')}
          </span>
        </div>
        <button
          type="button"
          onClick={onPreview}
          disabled={changeIds.length === 0}
          className="touch-target w-full cursor-pointer rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Prévisualiser le résultat
        </button>
      </div>

      {/* Fil des changements : un nœud par changement, cliquable pour y aller */}
      {changeIds.length > 0 && (
        <div className="flex shrink-0 items-center gap-3 border-b border-amber-900/30 bg-neutral-950/70 px-3 py-1.5 font-sans">
          <span className="shrink-0 text-[11px] text-amber-200/60">
            {decidedCount}/{changeIds.length} décidé{decidedCount > 1 ? 's' : ''}
          </span>
          <div className="ld-beads">
            {changeIds.map((id, index) => (
              <Fragment key={id}>
                {index > 0 && <span className="ld-bead-link" aria-hidden="true" />}
                <button
                  type="button"
                  className="ld-bead"
                  data-d={stateOf(id)}
                  onClick={() => jumpTo(id)}
                  aria-label={`Aller au changement ${index + 1} (${STATE_LABEL[stateOf(id)].toLowerCase()})`}
                  title={`Changement ${index + 1} · ${STATE_LABEL[stateOf(id)].toLowerCase()}`}
                >
                  {index + 1}
                </button>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Code */}
      <div ref={bodyRef} className="ld-body min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center font-sans text-sm text-amber-200/60">
            Aucune différence détectée : les deux versions sont identiques.
          </p>
        ) : (
          <>
            {/* Ordinateur : deux colonnes, une rangée = une ligne de chaque côté (toujours alignées) */}
            <div className="hidden md:block">
              <div className="ld-head ld-row">
                <div className="ld-tab ld-tab-del">
                  <span className="truncate">{oldLabel}</span>
                  <span className="ld-badge ld-badge-del">{oldBadge}</span>
                </div>
                <div className="ld-tab ld-tab-add ld-r">
                  <span className="truncate">{currentLabel}</span>
                  <span className="ld-badge ld-badge-add">{currentBadge}</span>
                </div>
              </div>
              {items.map(desktopItem)}
            </div>

            {/* Mobile : un seul flux, suppressions puis ajouts */}
            <div className="md:hidden">
              <div className="ld-head">
                <div className="ld-tab ld-tab-add">
                  <span className="truncate">Comparaison avec {oldLabel}</span>
                  <span className="shrink-0 text-[10px] text-amber-200/60">− supprimé · + ajouté</span>
                </div>
              </div>
              {items.map(mobileItem)}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default DiffView;