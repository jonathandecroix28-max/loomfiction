import { Fragment, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { buildRows, type Cell, type DiffRowData, type DRow } from './diffRows';
import './diff.css';



export interface DiffViewProps {
  rows: DiffRowData[];
  changeIds: number[];
  decisions?: Record<number, boolean>;
  onDecide?: (changeId: number, accepted: boolean) => void;
  hideIdentical?: boolean;
  onHideIdenticalChange?: (hide: boolean) => void;
  onPreview?: () => void;
  embedded?: boolean;
  className?: string;
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


const NO_DECISIONS: Record<number, boolean> = {};

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const STATE_LABEL: Record<DecisionState, string> = {
  pending: 'À décider',
  accepted: 'Actuel gardé',
  rejected: 'Ancien repris',
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
  decisions = NO_DECISIONS,
  onDecide,
  hideIdentical: hideProp,
  onHideIdenticalChange,
  onPreview,
  embedded = false,
  className = '',
  oldLabel,
  oldBadge = 'Ancienne version',
  currentLabel,
  currentBadge = 'Actuel',
}: DiffViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [innerHide, setInnerHide] = useState(false);
  const hideIdentical = hideProp ?? innerHide;
  const setHideIdentical = onHideIdenticalChange ?? setInnerHide;
  const interactive = onDecide !== undefined;
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
      <div key={`${prefix}h${item.id}`} className="ld-hunk" data-hunk={item.id} data-d={interactive ? state : undefined}>
        <span className="ld-knot" aria-hidden="true" />
        <span className="font-medium text-amber-100">Changement {item.index + 1}</span>
        <span className="tabular-nums">
          <span className="ld-del-t">−{item.del}</span> <span className="ld-add-t">+{item.add}</span>
        </span>
        <span className="ld-stitch" aria-hidden="true" />
        {interactive && (
          <>
            <span className="text-[11px] text-amber-200/60">{STATE_LABEL[state]}</span>
            {/* Les boutons suivent la place des colonnes : l’ancien à gauche, l’actuel à droite */}
            <button
              type="button"
              className="ld-btn ld-no"
              data-on={state === 'rejected'}
              aria-pressed={state === 'rejected'}
              title="Revenir au texte de l’ancienne version pour ce changement"
              onClick={() => onDecide?.(item.id, false)}
            >
              Reprendre l’ancien
            </button>
            <button
              type="button"
              className="ld-btn ld-yes"
              data-on={state === 'accepted'}
              aria-pressed={state === 'accepted'}
              title="Garder le texte actuel pour ce changement"
              onClick={() => onDecide?.(item.id, true)}
            >
              Garder l’actuel
            </button>
          </>
        )}
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

  const Root = embedded ? 'div' : 'main';

  return (
    <Root
      className={`loom-diff flex min-h-0 flex-1 flex-col overflow-hidden text-xs sm:text-sm ${
        embedded ? 'rounded-xl border border-amber-900/30' : ''
      } ${className}`}
    >
            {/* Barre d’outils */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-amber-900/30 bg-neutral-950 px-3 py-2 font-sans">
        {interactive && changeIds.length > 0 && (
          <p className="text-[11px] text-amber-200/60 sm:text-xs">
            Pour chaque changement, choisis le texte à garder (ancien à gauche, actuel à droite), puis clique sur
            « Voir le résultat ».
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-amber-200/80">
              <input
                type="checkbox"
                className="sr-only"
                checked={hideIdentical}
                onChange={(event) => setHideIdentical(event.target.checked)}
              />
              <span className="ld-switch" aria-hidden="true" />
              Masquer les lignes identiques
            </label>
            <span className="shrink-0 text-[11px] text-amber-200/60">
              {changeIds.length === 0 ? 'Aucun changement' : plural(changeIds.length, 'changement', 'changements')}
            </span>
            {interactive && changeIds.length > 1 && (
              <div className="ld-seg" role="group" aria-label="Appliquer le même choix à tous les changements">
                <button type="button" onClick={() => changeIds.forEach((id) => onDecide?.(id, false))}>
                  Tout reprendre l’ancien
                </button>
                <button type="button" onClick={() => changeIds.forEach((id) => onDecide?.(id, true))}>
                  Tout garder l’actuel
                </button>
              </div>
            )}
          </div>
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              disabled={changeIds.length === 0}
              className="touch-target w-full cursor-pointer rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Voir le résultat
            </button>
          )}
        </div>
      </div>

      {/* Fil des changements : un nœud par changement, cliquable pour y aller */}
      {changeIds.length > 0 && (
        <div className="flex shrink-0 items-center gap-3 border-b border-amber-900/30 bg-neutral-950/70 px-3 py-1.5 font-sans">
          <span className="shrink-0 text-[11px] text-amber-200/60">
            {interactive
              ? `${decidedCount}/${changeIds.length} décidé${decidedCount > 1 ? 's' : ''}`
              : plural(changeIds.length, 'changement', 'changements')}
          </span>
          <div className="ld-beads">
            {changeIds.map((id, index) => (
              <Fragment key={id}>
                {index > 0 && <span className="ld-bead-link" aria-hidden="true" />}
                <button
                  type="button"
                  className="ld-bead"
                  data-d={interactive ? stateOf(id) : undefined}
                  onClick={() => jumpTo(id)}
                  aria-label={`Aller au changement ${index + 1}`}
                  title={interactive ? `Changement ${index + 1} · ${STATE_LABEL[stateOf(id)].toLowerCase()}` : `Changement ${index + 1}`}
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
    </Root>
  );
}

export default DiffView;