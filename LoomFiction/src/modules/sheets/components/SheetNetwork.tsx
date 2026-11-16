import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useSheets } from '../hooks/useSheets';
import { useIdeas } from '../../ideas/hooks/useIdeas';
import { useCategories } from '../../categories/hooks/useCategories';
import { useDataChanged } from '../../../hooks/useDataChanged';
import { buildSheetGraph, normalizeName } from '../sheetGraph';

interface SheetNetworkProps {
  currentSheetId: number | null;
  onOpenSheet: (sheetId: number) => void;
  /** Mode immersion : l'en-tête de la page est masqué. */
  isImmersive?: boolean;
  /** Affiche / masque l'en-tête de la page (le bouton n'apparaît que si fourni). */
  onToggleImmersive?: () => void;
}

type SimNode = { id: number; x: number; y: number; vx: number; vy: number; r: number; fixed: boolean };
type SimLink = { s: SimNode; t: SimNode };
type Sim = { nodes: SimNode[]; links: SimLink[] };
type Positions = Record<number, { x: number; y: number }>;

const NO_CATEGORY = 'none';
const FALLBACK_COLOR = '#78716c';
const REPULSION = 20000;
const LINK_DISTANCE = 120;
const GRAVITY = 0.02;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const radiusOf = (degree: number) => 9 + Math.min(14, Math.sqrt(degree) * 4);

/** Un pas de simulation « force-directed » (répulsion, ressorts, gravité). */
function tickSim(sim: Sim, alpha: number) {
  const { nodes, links } = sim;

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        dx = (i - j) * 0.5 || 0.5;
        dy = 0.5;
        d2 = dx * dx + dy * dy;
      }
      const dist = Math.sqrt(d2);
      const force = (REPULSION / d2) * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;

      const minDist = a.r + b.r + 16;
      if (dist < minDist) {
        const push = (minDist - dist) * 0.05;
        a.vx -= (dx / dist) * push;
        a.vy -= (dy / dist) * push;
        b.vx += (dx / dist) * push;
        b.vy += (dy / dist) * push;
      }
    }
  }

  for (const { s, t } of links) {
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const force = (dist - LINK_DISTANCE) * 0.08 * alpha;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    s.vx += fx;
    s.vy += fy;
    t.vx -= fx;
    t.vy -= fy;
  }

  for (const node of nodes) {
    if (node.fixed) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx -= node.x * GRAVITY * alpha;
    node.vy -= node.y * GRAVITY * alpha;
    node.vx *= 0.65;
    node.vy *= 0.65;
    node.x += node.vx;
    node.y += node.vy;
  }
}

const chip = (active: boolean) =>
  `touch-target inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 font-sans text-xs transition ${
    active
      ? 'border-amber-600 bg-amber-700 text-amber-50'
      : 'border-amber-900/40 bg-neutral-900/90 text-amber-200/70 hover:bg-neutral-800'
  }`;

const iconBtn =
  'touch-target flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-amber-900/40 bg-neutral-900/90 font-sans text-base text-amber-200/80 shadow-md transition hover:bg-neutral-800 hover:text-amber-100';

export function SheetNetwork({ currentSheetId, onOpenSheet, isImmersive = false, onToggleImmersive }: SheetNetworkProps) {
  const { sheets, refreshSheets } = useSheets();
  const { ideas, isLoading, refreshIdeas } = useIdeas(null);
  const { categories } = useCategories();

  useDataChanged(() => {
    void refreshSheets();
    void refreshIdeas();
  });

  const [query, setQuery] = useState('');
  const [hideIsolated, setHideIsolated] = useState(true);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(currentSheetId);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [positions, setPositions] = useState<Positions>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSelectedId(currentSheetId);
  }, [currentSheetId]);

  useEffect(() => {
    if (!isImmersive || !onToggleImmersive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggleImmersive();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isImmersive, onToggleImmersive]);

  /* ───────────── Données du graphe ───────────── */

  const links = useMemo(() => buildSheetGraph(sheets, ideas), [sheets, ideas]);

  const degree = useMemo(() => {
    const neighbours = new Map<number, Set<number>>();
    const add = (a: number, b: number) => {
      const set = neighbours.get(a) ?? new Set<number>();
      set.add(b);
      neighbours.set(a, set);
    };
    for (const link of links) {
      add(link.source, link.target);
      add(link.target, link.source);
    }
    return new Map(Array.from(neighbours, ([id, set]) => [id, set.size]));
  }, [links]);

  const categoryKeyOf = useCallback(
    (categoryId: number | null | undefined) =>
      categories.some((category) => category.id === categoryId) ? String(categoryId) : NO_CATEGORY,
    [categories],
  );

  const colorOfCategory = useCallback(
    (categoryId: number | null | undefined) =>
      (categories.find((category) => category.id === categoryId)?.color as string | undefined) ?? FALLBACK_COLOR,
    [categories],
  );

  const effectiveHideIsolated = hideIsolated && links.length > 0;

  const visibleSheets = useMemo(
    () =>
      sheets.filter((sheet) => {
        if (sheet.id === currentSheetId) return true;
        if (hiddenCategories.has(categoryKeyOf(sheet.categoryId))) return false;
        if (effectiveHideIsolated && !degree.get(sheet.id)) return false;
        return true;
      }),
    [sheets, currentSheetId, hiddenCategories, categoryKeyOf, effectiveHideIsolated, degree],
  );

  const visibleLinks = useMemo(() => {
    const ids = new Set(visibleSheets.map((sheet) => sheet.id));
    return links.filter((link) => ids.has(link.source) && ids.has(link.target));
  }, [visibleSheets, links]);

  const sheetById = useMemo(() => new Map(sheets.map((sheet) => [sheet.id, sheet])), [sheets]);

  const adjacency = useMemo(() => {
    const out = new Map<number, number[]>();
    const incoming = new Map<number, number[]>();
    for (const link of visibleLinks) {
      out.set(link.source, [...(out.get(link.source) ?? []), link.target]);
      incoming.set(link.target, [...(incoming.get(link.target) ?? []), link.source]);
    }
    return { out, incoming };
  }, [visibleLinks]);

  const presentCategoryKeys = useMemo(
    () => new Set(sheets.map((sheet) => categoryKeyOf(sheet.categoryId))),
    [sheets, categoryKeyOf],
  );

  /* ───────────── Simulation ───────────── */

  const nodesRef = useRef(new Map<number, SimNode>());
  const simRef = useRef<Sim>({ nodes: [], links: [] });
  const alphaRef = useRef(0);
  const rafRef = useRef(0);
  const runningRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fittedRef = useRef(false);

  const snapshot = useCallback(() => {
    const next: Positions = {};
    for (const node of simRef.current.nodes) next[node.id] = { x: node.x, y: node.y };
    setPositions(next);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    const frame = () => {
      if (alphaRef.current < 0.01) {
        runningRef.current = false;
        return;
      }
      tickSim(simRef.current, alphaRef.current);
      alphaRef.current *= 0.985;
      snapshot();
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [snapshot]);

  const fitView = useCallback(() => {
    const el = containerRef.current;
    const nodes = simRef.current.nodes;
    if (!el || el.clientWidth === 0 || nodes.length === 0) return false;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      minY = Math.min(minY, node.y - node.r);
      maxY = Math.max(maxY, node.y + node.r + 20);
    }
    const width = Math.max(1, maxX - minX + 120);
    const height = Math.max(1, maxY - minY + 120);
    const k = clamp(Math.min(el.clientWidth / width, el.clientHeight / height), MIN_ZOOM, 1.2);
    setView({
      k,
      x: el.clientWidth / 2 - ((minX + maxX) / 2) * k,
      y: el.clientHeight / 2 - ((minY + maxY) / 2) * k,
    });
    return true;
  }, []);

  useEffect(() => {
    let hasNew = false;
    const nodes = visibleSheets.map((sheet, index) => {
      const radius = radiusOf(degree.get(sheet.id) ?? 0);
      let node = nodesRef.current.get(sheet.id);
      if (!node) {
        hasNew = true;
        const angle = index * 2.399963; 
        const distance = 30 + 22 * Math.sqrt(index);
        node = {
          id: sheet.id,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          vx: 0,
          vy: 0,
          r: radius,
          fixed: false,
        };
        nodesRef.current.set(sheet.id, node);
      } else {
        node.r = radius;
      }
      return node;
    });

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const simLinks = visibleLinks.flatMap((link) => {
      const s = byId.get(link.source);
      const t = byId.get(link.target);
      return s && t ? [{ s, t }] : [];
    });
    simRef.current = { nodes, links: simLinks };

    if (hasNew) {
      let alpha = 1;
      for (let i = 0; i < 300; i++) {
        tickSim(simRef.current, alpha);
        alpha *= 0.99;
      }
    }

    alphaRef.current = 0.3;
    snapshot();
    start();

    if (!fittedRef.current && fitView()) fittedRef.current = true;
  }, [visibleSheets, visibleLinks, degree, snapshot, start, fitView]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!fittedRef.current && fitView()) fittedRef.current = true;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitView]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    },
    [],
  );

  /* ───────────── Zoom / déplacement ───────────── */

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = Math.exp(-event.deltaY * 0.0015);
      setView((current) => {
        const k = clamp(current.k * factor, MIN_ZOOM, MAX_ZOOM);
        const ratio = k / current.k;
        return { k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    setView((current) => {
      const k = clamp(current.k * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = k / current.k;
      return { k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  };

  const focusNode = (id: number) => {
    const el = containerRef.current;
    const node = nodesRef.current.get(id);
    if (!el || !node) return;
    setView((current) => {
      const k = Math.max(current.k, 0.9);
      return { k, x: el.clientWidth / 2 - node.x * k, y: el.clientHeight / 2 - node.y * k };
    });
  };

  const resetLayout = () => {
    for (const node of simRef.current.nodes) node.fixed = false;
    alphaRef.current = 1;
    start();
    window.setTimeout(() => void fitView(), 600);
  };

  type Drag = {
    kind: 'pan' | 'node';
    id: number | null;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
    threshold: number;
  };
  const dragRef = useRef<Drag | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; k: number; wx: number; wy: number } | null>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const trackPointer = (event: { pointerId: number; clientX: number; clientY: number }) => {
    svgRef.current?.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  /** Deux doigts : le zoom se fait autour du milieu des doigts, qui peut aussi déplacer la vue. */
  const beginPinch = () => {
    const el = containerRef.current;
    const [p1, p2] = Array.from(pointersRef.current.values());
    if (!el || !p1 || !p2) return;

    const drag = dragRef.current;
    if (drag?.kind === 'node' && drag.id !== null && !drag.moved) {
      const node = nodesRef.current.get(drag.id);
      if (node) node.fixed = false;
    }
    dragRef.current = null;

    const rect = el.getBoundingClientRect();
    const midX = (p1.x + p2.x) / 2 - rect.left;
    const midY = (p1.y + p2.y) / 2 - rect.top;
    const v = viewRef.current;
    pinchRef.current = {
      dist: Math.max(1, Math.hypot(p1.x - p2.x, p1.y - p2.y)),
      k: v.k,
      wx: (midX - v.x) / v.k,
      wy: (midY - v.y) / v.k,
    };
  };

  const onBackgroundDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    trackPointer(event);
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    dragRef.current = {
      kind: 'pan',
      id: null,
      sx: event.clientX,
      sy: event.clientY,
      ox: view.x,
      oy: view.y,
      moved: false,
      threshold: event.pointerType === 'mouse' ? 4 : 10,
    };
  };

  const onNodeDown = (event: ReactPointerEvent<SVGGElement>, id: number) => {
    event.stopPropagation();
    trackPointer(event);
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    const node = nodesRef.current.get(id);
    if (!node) return;
    node.fixed = true;
    dragRef.current = {
      kind: 'node',
      id,
      sx: event.clientX,
      sy: event.clientY,
      ox: node.x,
      oy: node.y,
      moved: false,
      threshold: event.pointerType === 'mouse' ? 4 : 10,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const el = containerRef.current;
      const [p1, p2] = Array.from(pointersRef.current.values());
      if (!el || !p1 || !p2) return;
      const rect = el.getBoundingClientRect();
      const midX = (p1.x + p2.x) / 2 - rect.left;
      const midY = (p1.y + p2.y) / 2 - rect.top;
      const dist = Math.max(1, Math.hypot(p1.x - p2.x, p1.y - p2.y));
      const k = clamp((pinch.k * dist) / pinch.dist, MIN_ZOOM, MAX_ZOOM);
      setView({ k, x: midX - pinch.wx * k, y: midY - pinch.wy * k });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.sx;
    const dy = event.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > drag.threshold) drag.moved = true;
    if (!drag.moved) return;

    if (drag.kind === 'pan') {
      setView((current) => ({ ...current, x: drag.ox + dx, y: drag.oy + dy }));
      return;
    }
    const node = drag.id !== null ? nodesRef.current.get(drag.id) : undefined;
    if (!node) return;
    node.x = drag.ox + dx / view.k;
    node.y = drag.oy + dy / view.k;
    node.vx = 0;
    node.vy = 0;
    alphaRef.current = Math.max(alphaRef.current, 0.3);
    start();
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);

    if (pinchRef.current) {
      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
        // Un doigt reste posé : on reprend le déplacement sans saut ni désélection.
        const rest = Array.from(pointersRef.current.values())[0];
        const v = viewRef.current;
        dragRef.current = rest
          ? { kind: 'pan', id: null, sx: rest.x, sy: rest.y, ox: v.x, oy: v.y, moved: true, threshold: 0 }
          : null;
      }
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind === 'node' && drag.id !== null) {
      const node = nodesRef.current.get(drag.id);
      // Un nœud déplacé reste épinglé là où on l'a posé ; un simple clic le sélectionne.
      if (node && !drag.moved) node.fixed = false;
      if (!drag.moved) setSelectedId(drag.id);
    } else if (!drag.moved) {
      setSelectedId(null);
    }
  };

  /* ───────────── Recherche / surbrillance ───────────── */

  const normalizedQuery = normalizeName(query);
  const matches = useMemo(() => {
    if (!normalizedQuery) return null;
    return new Set(
      visibleSheets.filter((sheet) => normalizeName(sheet.name).includes(normalizedQuery)).map((sheet) => sheet.id),
    );
  }, [normalizedQuery, visibleSheets]);

  const activeId = hoverId ?? selectedId;
  const activeNeighbours = useMemo(() => {
    const set = new Set<number>();
    if (activeId == null) return set;
    set.add(activeId);
    for (const id of adjacency.out.get(activeId) ?? []) set.add(id);
    for (const id of adjacency.incoming.get(activeId) ?? []) set.add(id);
    return set;
  }, [activeId, adjacency]);

  const toggleCategory = (key: string) =>
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedSheet = selectedId != null ? sheetById.get(selectedId) : undefined;
  const selectedVisible = selectedId != null && positions[selectedId] !== undefined;

  const emptyMessage = isLoading
    ? 'Chargement du réseau…'
    : sheets.length === 0
      ? 'Aucune fiche pour le moment.'
      : visibleSheets.length === 0
        ? 'Aucune fiche à afficher avec ces filtres.'
        : null;

  return (
    <div ref={containerRef} className="relative min-h-[320px] w-full flex-1 overflow-hidden font-sans print:hidden">
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full touch-none select-none [-webkit-tap-highlight-color:transparent]"
        onPointerDown={onBackgroundDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label="Réseau des fiches liées par leurs mentions"
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {visibleLinks.map((link) => {
            const a = positions[link.source];
            const b = positions[link.target];
            if (!a || !b) return null;
            const hot = activeId != null && (link.source === activeId || link.target === activeId);
            const dim = (activeId != null && !hot) || (matches !== null && !(matches.has(link.source) && matches.has(link.target)));
            return (
              <line
                key={`${link.source}-${link.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={hot ? 'stroke-amber-400' : 'stroke-amber-700'}
                strokeOpacity={dim ? 0.1 : hot ? 0.95 : 0.5}
                strokeWidth={1 + Math.min(link.count, 5) * 0.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {visibleSheets.map((sheet) => {
            const p = positions[sheet.id];
            if (!p) return null;
            const radius = radiusOf(degree.get(sheet.id) ?? 0);
            const isCurrent = sheet.id === currentSheetId;
            const isSelected = sheet.id === selectedId;
            const isMatch = matches?.has(sheet.id) ?? false;
            const dim = (activeId != null && !activeNeighbours.has(sheet.id)) || (matches !== null && !isMatch);
            const showLabel = view.k > 0.55 || activeNeighbours.has(sheet.id) || isMatch || isCurrent;

            return (
              <g
                key={sheet.id}
                transform={`translate(${p.x} ${p.y})`}
                opacity={dim ? 0.25 : 1}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={sheet.name}
                onPointerDown={(event) => onNodeDown(event, sheet.id)}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setHoverId(sheet.id);
                }}
                onPointerLeave={() => setHoverId(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedId(sheet.id);
                  }
                }}
              >
                <circle r={radius + 12} fill="transparent" />
                {(isCurrent || isSelected || isMatch) && (
                  <circle r={radius + 6} fill="none" className="stroke-amber-300" strokeWidth={isCurrent ? 2.5 : 1.5} strokeDasharray={isCurrent ? undefined : '4 3'} />
                )}
                <circle r={radius} fill={colorOfCategory(sheet.categoryId)} className="stroke-amber-100" strokeWidth={1.5} />
                {showLabel && (
                  <text
                    y={radius + 15}
                    textAnchor="middle"
                    fontSize={12}
                    className="fill-amber-100"
                    pointerEvents="none"
                    style={{ stroke: 'var(--c-page)', strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }}
                  >
                    {sheet.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {emptyMessage && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center font-serif text-amber-200/60">
          {emptyMessage}
        </p>
      )}

      {!emptyMessage && links.length === 0 && (
        <p className="pointer-events-none absolute inset-x-4 bottom-16 mx-auto max-w-md rounded-xl border border-amber-900/30 bg-neutral-950/80 px-4 py-3 text-center text-xs text-amber-200/70">
          Aucune mention entre fiches pour l’instant. Mentionne une fiche avec « @ » dans une carte, ou utilise « Détecter les fiches ».
        </p>
      )}

      {/* Filtres : repliables sur mobile */}
      <div className="absolute left-3 right-16 top-[max(0.75rem,env(safe-area-inset-top))] flex max-w-2xl flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !matches || matches.size === 0) return;
              const first = visibleSheets.find((sheet) => matches.has(sheet.id));
              if (first) {
                setSelectedId(first.id);
                focusNode(first.id);
              }
            }}
            placeholder="Rechercher une fiche…"
            aria-label="Rechercher une fiche dans le réseau"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-amber-900/40 bg-neutral-900/90 px-3 py-2 text-base text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:min-h-0 sm:max-w-xs sm:text-xs"
          />
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            className={`${chip(showFilters)} sm:hidden`}
          >
            Filtres
          </button>
        </div>

        <div
          className={`${showFilters ? 'flex' : 'hidden'} max-h-[40dvh] flex-wrap gap-2 overflow-y-auto rounded-xl border border-amber-900/40 bg-neutral-950/90 p-2 sm:flex sm:max-h-none sm:flex-nowrap sm:overflow-x-auto sm:overflow-y-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:pb-1 sm:scrollbar-none`}
        >
          <button type="button" onClick={() => setHideIsolated((value) => !value)} className={chip(effectiveHideIsolated)} aria-pressed={effectiveHideIsolated}>
            Masquer les fiches isolées
          </button>
          {categories
            .filter((category) => presentCategoryKeys.has(String(category.id)))
            .map((category) => {
              const key = String(category.id);
              return (
                <button key={key} type="button" onClick={() => toggleCategory(key)} className={chip(!hiddenCategories.has(key))} aria-pressed={!hiddenCategories.has(key)}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                </button>
              );
            })}
          {presentCategoryKeys.has(NO_CATEGORY) && (
            <button type="button" onClick={() => toggleCategory(NO_CATEGORY)} className={chip(!hiddenCategories.has(NO_CATEGORY))} aria-pressed={!hiddenCategories.has(NO_CATEGORY)}>
              <span className="size-2 rounded-full" style={{ backgroundColor: FALLBACK_COLOR }} />
              Sans catégorie
            </button>
          )}
        </div>
      </div>

      {/* Contrôles de vue */}
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col gap-2">
        {onToggleImmersive && (
          <button
            type="button"
            onClick={onToggleImmersive}
            className={iconBtn}
            aria-label={isImmersive ? 'Afficher l’en-tête' : 'Masquer l’en-tête'}
            title={isImmersive ? 'Afficher l’en-tête (Échap)' : 'Masquer l’en-tête pour plus d’espace'}
          >
            {isImmersive ? '⌄' : '⌃'}
          </button>
        )}
        <button type="button" onClick={() => zoomBy(1.25)} className={iconBtn} aria-label="Zoom avant" title="Zoom avant">+</button>
        <button type="button" onClick={() => zoomBy(0.8)} className={iconBtn} aria-label="Zoom arrière" title="Zoom arrière">−</button>
        <button type="button" onClick={() => void fitView()} className={iconBtn} aria-label="Tout afficher" title="Tout afficher">⤢</button>
        <button type="button" onClick={resetLayout} className={iconBtn} aria-label="Réorganiser le réseau" title="Réorganiser (libère les fiches déplacées)">↻</button>
      </div>

      <p className={`pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 rounded-lg bg-neutral-950/70 px-2.5 py-1 text-[11px] text-amber-200/60 ${selectedSheet && selectedVisible ? 'hidden sm:block' : ''}`}>
        {visibleSheets.length} fiche{visibleSheets.length > 1 ? 's' : ''} · {visibleLinks.length} lien{visibleLinks.length > 1 ? 's' : ''}
      </p>

      {/* Détail de la fiche sélectionnée */}
      {selectedSheet && selectedVisible && (
        <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[45%] overflow-y-auto rounded-2xl border border-amber-900/40 bg-neutral-950/95 p-4 shadow-xl sm:inset-x-auto sm:left-3 sm:w-80">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-amber-200/60">
                <span className="size-2 rounded-full" style={{ backgroundColor: colorOfCategory(selectedSheet.categoryId) }} />
                {categories.find((category) => category.id === selectedSheet.categoryId)?.name ?? 'Sans catégorie'}
              </p>
              <h3 className="truncate font-serif text-lg font-bold text-amber-100">{selectedSheet.name}</h3>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Fermer" className="touch-target min-w-9 cursor-pointer text-amber-200/60 hover:text-amber-100">✕</button>
          </div>

          {(['out', 'incoming'] as const).map((direction) => {
            const ids = adjacency[direction].get(selectedSheet.id) ?? [];
            return (
              <div key={direction} className="mb-3">
                <p className="mb-1.5 text-xs text-amber-200/60">
                  {direction === 'out' ? 'Mentionne' : 'Mentionnée par'} ({ids.length})
                </p>
                {ids.length === 0 ? (
                  <p className="text-xs text-amber-200/40">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setSelectedId(id);
                          focusNode(id);
                        }}
                        className="cursor-pointer rounded-lg border border-amber-900/40 bg-neutral-900 px-2 py-1 text-xs text-amber-200 transition hover:bg-neutral-800"
                      >
                        {sheetById.get(id)?.name ?? `Fiche ${id}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => onOpenSheet(selectedSheet.id)}
            disabled={selectedSheet.id === currentSheetId}
            className="touch-target w-full cursor-pointer rounded-xl border border-amber-600 bg-amber-700 px-4 py-2 text-sm font-medium text-amber-50 shadow-md transition hover:bg-amber-600 disabled:cursor-default disabled:opacity-50"
          >
            {selectedSheet.id === currentSheetId ? 'Fiche actuelle' : 'Ouvrir la fiche'}
          </button>
        </div>
      )}
    </div>
  );
}

export default SheetNetwork;