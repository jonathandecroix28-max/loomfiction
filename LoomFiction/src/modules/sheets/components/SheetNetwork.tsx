import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useSheets } from '../hooks/useSheets';
import { useIdeas } from '../../ideas/hooks/useIdeas';
import { useCategories } from '../../categories/hooks/useCategories';
import { useDataChanged } from '../../../hooks/useDataChanged';
import { buildSheetGraph, normalizeName } from '../sheetGraph';

/**
 * Réseau des fiches, pensé comme un métier à tisser :
 *  - chaque catégorie est un fil de chaîne vertical (une « branche » façon git) ;
 *  - chaque mention est un fil de trame qui passe d’une branche à l’autre (courbes de merge) ;
 *  - le temps s’écoule vers le bas (les fiches sont ordonnées par id, donc par création).
 *
 * Performance : la simulation et la caméra écrivent directement dans le DOM (transform / d).
 * React ne re-rend que lors d’un survol, d’une sélection ou d’un changement de données.
 */

interface SheetNetworkProps {
  currentSheetId: number | null;
  onOpenSheet: (sheetId: number) => void;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
}

type SimNode = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  deg: number;
  lane: string;
  lx: number;
  ty: number;
  fixed: boolean;
};
type SimLink = { key: string; s: SimNode; t: SimNode };
type Sim = { nodes: SimNode[]; links: SimLink[]; lanes: boolean };
type View = { x: number; y: number; k: number };

const NO_CATEGORY = 'none';
const FALLBACK_COLOR = '#78716c';
const REPULSION = 9000;
const LINK_DISTANCE = 150;
const GRAVITY = 0.02;
const LANE_GAP = 230;
const LANE_PULL = 0.1;
const ROW_PULL = 0.05;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const LABEL_ZOOM = 0.55;
const DOUBLE_TAP_MS = 350;
const INK = '#0b0806';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const radiusOf = (degree: number) => 8 + Math.min(12, Math.sqrt(degree) * 3.5);

/** Courbe de « merge » façon git : départ et arrivée verticaux, arrêtée au bord de la fiche cible. */
function threadPath(s: SimNode, t: SimNode) {
  const dy = t.y - s.y;
  const c1y = s.y + dy * 0.55;
  const c2y = t.y - dy * 0.55;
  let tx = 0;
  let ty = t.y - c2y;
  if (Math.abs(ty) < 12) {
    tx = t.x - s.x;
    ty = t.y - s.y;
  }
  const len = Math.hypot(tx, ty) || 1;
  const gap = t.r + 4;
  const ex = t.x - (tx / len) * gap;
  const ey = t.y - (ty / len) * gap;
  return `M${s.x.toFixed(1)},${s.y.toFixed(1)} C${s.x.toFixed(1)},${c1y.toFixed(1)} ${t.x.toFixed(1)},${c2y.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

function tickSim(sim: Sim, alpha: number) {
  const { nodes, links, lanes } = sim;

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

      const minDist = a.r + b.r + 18;
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
    const strength = 0.05 / Math.max(1, Math.sqrt((s.deg + t.deg) / 4));
    const force = (dist - LINK_DISTANCE) * strength * alpha;
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
    if (lanes) {
      node.vx += (node.lx - node.x) * LANE_PULL * alpha;
      node.vy += (node.ty - node.y) * ROW_PULL * alpha;
    } else {
      node.vx -= node.x * GRAVITY * alpha;
      node.vy -= node.y * GRAVITY * alpha;
    }
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
  'touch-target flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-amber-900/40 bg-neutral-900/90 font-sans text-base text-amber-200/80 shadow-md transition hover:bg-neutral-800 hover:text-amber-100 active:scale-95';

/* Animations « one-shot » uniquement : rien ne tourne en boucle. */
const CSS = `
@keyframes sn-pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
@keyframes sn-ping{0%{transform:scale(.8);opacity:.8}100%{transform:scale(2.8);opacity:0}}
@keyframes sn-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes sn-slide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes sn-hint{0%,65%{opacity:1}100%{opacity:0}}
.sn-pop{transform-origin:0 0;animation:sn-pop .45s ease-out backwards}
.sn-ping{transform-origin:0 0;opacity:0;animation:sn-ping .9s ease-out forwards}
.sn-draw{stroke-dasharray:1;animation:sn-draw .5s ease-out both}
.sn-slide{animation:sn-slide .3s ease-out both}
.sn-hint{animation:sn-hint 9s ease forwards}
.wv-far .wv-label:not(.wv-keep){display:none}
@media (prefers-reduced-motion: reduce){
  .sn-pop,.sn-ping,.sn-draw,.sn-slide,.sn-hint{animation:none!important}
}
`;

/* Tissu : sergé diagonal très discret + fils de chaîne verticaux. Statique, donc quasi gratuit. */
const LOOM_BACKGROUND = [
  'repeating-linear-gradient(90deg, rgba(231,190,130,0.045) 0 1px, transparent 1px 12px)',
  'repeating-linear-gradient(45deg, rgba(231,190,130,0.025) 0 2px, transparent 2px 7px)',
  'radial-gradient(120% 90% at 50% 40%, #1d1510 0%, #110b08 55%, #080605 100%)',
].join(', ');

export function SheetNetwork({ currentSheetId, onOpenSheet, isImmersive = false, onToggleImmersive }: SheetNetworkProps) {
  const { sheets, refreshSheets } = useSheets();
  const { ideas, isLoading, refreshIdeas } = useIdeas(null);
  const { categories } = useCategories();
  const uid = useId().replace(/:/g, '');

  useDataChanged(() => {
    void refreshSheets();
    void refreshIdeas();
  });

  const [query, setQuery] = useState('');
  const [hideIsolated, setHideIsolated] = useState(true);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(currentSheetId);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [touring, setTouring] = useState(false);
  const [laneMode, setLaneMode] = useState(true);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    setSelectedId(currentSheetId);
  }, [currentSheetId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (touring) {
        setTouring(false);
        return;
      }
      if (isImmersive && onToggleImmersive) onToggleImmersive();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [touring, isImmersive, onToggleImmersive]);

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
      (categories.find((category) => category.id === categoryId)?.color as string | undefined) || FALLBACK_COLOR,
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

  const visibleIds = useMemo(() => new Set(visibleSheets.map((sheet) => sheet.id)), [visibleSheets]);

  const visibleLinks = useMemo(
    () => links.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target)),
    [visibleIds, links],
  );

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

  /** Les « fils de chaîne » : une colonne par catégorie présente. */
  const lanes = useMemo(() => {
    const present = new Set(visibleSheets.map((sheet) => categoryKeyOf(sheet.categoryId)));
    const list: { key: string; name: string; color: string }[] = [];
    for (const category of categories) {
      if (present.has(String(category.id))) {
        list.push({ key: String(category.id), name: category.name, color: (category.color as string) || FALLBACK_COLOR });
      }
    }
    if (present.has(NO_CATEGORY)) list.push({ key: NO_CATEGORY, name: 'Sans catégorie', color: FALLBACK_COLOR });
    return list.map((lane, index) => ({ ...lane, x: (index - (list.length - 1) / 2) * LANE_GAP }));
  }, [visibleSheets, categories, categoryKeyOf]);

  const laneX = useMemo(() => new Map(lanes.map((lane) => [lane.key, lane.x])), [lanes]);
  const laneXRef = useRef(laneX);

  /* ───────────── Simulation + rendu impératif ───────────── */

  const nodesRef = useRef(new Map<number, SimNode>());
  const simRef = useRef<Sim>({ nodes: [], links: [], lanes: true });
  const alphaRef = useRef(0);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const modeRef = useRef(laneMode);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const fittedRef = useRef(false);
  const camRef = useRef(0);
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 });

  const nodeEls = useRef(new Map<number, SVGGElement>());
  const linkEls = useRef(new Map<string, SVGGElement>());
  const laneLineEls = useRef(new Map<string, SVGLineElement>());
  const laneHeadEls = useRef(new Map<string, SVGGElement>());

  /** Écrit les positions directement dans le DOM, sans passer par React. */
  const paint = useCallback(() => {
    const { nodes, links: simLinks } = simRef.current;

    for (const node of nodes) {
      nodeEls.current.get(node.id)?.setAttribute('transform', `translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})`);
    }
    for (const link of simLinks) {
      const group = linkEls.current.get(link.key);
      if (!group) continue;
      const d = threadPath(link.s, link.t);
      for (const child of Array.from(group.children)) child.setAttribute('d', d);
    }

    if (laneLineEls.current.size > 0) {
      const bounds = new Map<string, { min: number; max: number }>();
      for (const node of nodes) {
        const b = bounds.get(node.lane);
        if (!b) bounds.set(node.lane, { min: node.y, max: node.y });
        else {
          b.min = Math.min(b.min, node.y);
          b.max = Math.max(b.max, node.y);
        }
      }
      for (const [key, line] of laneLineEls.current) {
        const b = bounds.get(key);
        if (!b) continue;
        line.setAttribute('y1', String(b.min - 26));
        line.setAttribute('y2', String(b.max + 40));
        laneHeadEls.current
          .get(key)
          ?.setAttribute('transform', `translate(${laneXRef.current.get(key) ?? 0} ${b.min - 46})`);
      }
    }
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
      paint();
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [paint]);

  /* ───────────── Caméra ───────────── */

  const applyView = useCallback((v: View) => {
    viewRef.current = v;
    worldRef.current?.setAttribute('transform', `translate(${v.x.toFixed(2)} ${v.y.toFixed(2)}) scale(${v.k.toFixed(4)})`);
    svgRef.current?.classList.toggle('wv-far', v.k <= LABEL_ZOOM);
  }, []);

  const stopCamera = useCallback(() => cancelAnimationFrame(camRef.current), []);

  /** Centre la caméra sur un point du monde ; le zoom est interpolé en échelle logarithmique. */
  const flyTo = useCallback(
    (cx: number, cy: number, k: number, duration = 700) => {
      const el = containerRef.current;
      if (!el) return;
      cancelAnimationFrame(camRef.current);
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (reducedMotion || duration <= 0) {
        applyView({ k, x: w / 2 - cx * k, y: h / 2 - cy * k });
        return;
      }
      const from = viewRef.current;
      const fcx = (w / 2 - from.x) / from.k;
      const fcy = (h / 2 - from.y) / from.k;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = clamp((now - t0) / duration, 0, 1);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const kk = from.k * Math.pow(k / from.k, e);
        applyView({ k: kk, x: w / 2 - (fcx + (cx - fcx) * e) * kk, y: h / 2 - (fcy + (cy - fcy) * e) * kk });
        if (p < 1) camRef.current = requestAnimationFrame(step);
      };
      camRef.current = requestAnimationFrame(step);
    },
    [reducedMotion, applyView],
  );

  const fitView = useCallback(
    (animate = false) => {
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
        minY = Math.min(minY, node.y - node.r - 50);
        maxY = Math.max(maxY, node.y + node.r + 40);
      }
      const width = Math.max(1, maxX - minX + 140);
      const height = Math.max(1, maxY - minY + 120);
      const k = clamp(Math.min(el.clientWidth / width, el.clientHeight / height), MIN_ZOOM, 1.2);
      flyTo((minX + maxX) / 2, (minY + maxY) / 2, k, animate ? 800 : 0);
      return true;
    },
    [flyTo],
  );

  useLayoutEffect(() => {
    laneXRef.current = laneX;
    const count = visibleSheets.length;
    const gap = clamp(1400 / Math.max(1, count), 34, 84);
    const rank = new Map([...visibleSheets].sort((a, b) => a.id - b.id).map((sheet, index) => [sheet.id, index]));

    let hasNew = false;
    const nodes = visibleSheets.map((sheet, index) => {
      const deg = degree.get(sheet.id) ?? 0;
      const lane = categoryKeyOf(sheet.categoryId);
      const lx = laneMode ? (laneX.get(lane) ?? 0) : 0;
      const ty = laneMode ? ((rank.get(sheet.id) ?? 0) - (count - 1) / 2) * gap : 0;
      let node = nodesRef.current.get(sheet.id);
      if (!node) {
        hasNew = true;
        const angle = index * 2.399963;
        const distance = 30 + 22 * Math.sqrt(index);
        node = {
          id: sheet.id,
          x: laneMode ? lx + (((index * 37) % 41) - 20) : Math.cos(angle) * distance,
          y: laneMode ? ty : Math.sin(angle) * distance,
          vx: 0,
          vy: 0,
          r: radiusOf(deg),
          deg,
          lane,
          lx,
          ty,
          fixed: false,
        };
        nodesRef.current.set(sheet.id, node);
      } else {
        node.r = radiusOf(deg);
        node.deg = deg;
        node.lane = lane;
        node.lx = lx;
        node.ty = ty;
      }
      return node;
    });

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const simLinks = visibleLinks.flatMap((link) => {
      const s = byId.get(link.source);
      const t = byId.get(link.target);
      return s && t ? [{ key: `${link.source}-${link.target}`, s, t }] : [];
    });
    simRef.current = { nodes, links: simLinks, lanes: laneMode };

    if (hasNew) {
      let alpha = 1;
      for (let i = 0; i < 200; i++) {
        tickSim(simRef.current, alpha);
        alpha *= 0.985;
      }
    }

    const modeChanged = modeRef.current !== laneMode;
    modeRef.current = laneMode;
    alphaRef.current = modeChanged ? 1 : 0.3;

    paint();
    start();

    if (!fittedRef.current && fitView()) fittedRef.current = true;
    else if (modeChanged) window.setTimeout(() => void fitView(true), 700);
  }, [visibleSheets, visibleLinks, degree, laneMode, laneX, categoryKeyOf, paint, start, fitView]);

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
      cancelAnimationFrame(camRef.current);
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
      stopCamera();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const current = viewRef.current;
      const k = clamp(current.k * Math.exp(-event.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
      const ratio = k / current.k;
      applyView({ k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [stopCamera, applyView]);

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const v = viewRef.current;
    const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
    flyTo((el.clientWidth / 2 - v.x) / v.k, (el.clientHeight / 2 - v.y) / v.k, k, 250);
  };

  const focusNode = useCallback(
    (id: number, zoom?: number) => {
      const node = nodesRef.current.get(id);
      if (!node) return;
      flyTo(node.x, node.y, zoom ?? Math.max(viewRef.current.k, 0.9), 750);
    },
    [flyTo],
  );

  const resetLayout = () => {
    for (const node of simRef.current.nodes) node.fixed = false;
    alphaRef.current = 1;
    start();
    window.setTimeout(() => void fitView(true), 600);
  };

  /* ───────────── Visite guidée ───────────── */

  useEffect(() => {
    if (!touring) return;
    const order = [...visibleSheets].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)).slice(0, 12);
    if (order.length === 0) return;
    let i = 0;
    let timer = 0;
    const go = () => {
      const sheet = order[i % order.length];
      i += 1;
      setSelectedId(sheet.id);
      focusNode(sheet.id, 1.1);
      timer = window.setTimeout(go, 3400);
    };
    timer = window.setTimeout(go, 0);
    return () => window.clearTimeout(timer);
  }, [touring, visibleSheets, degree, focusNode]);

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
  const lastTapRef = useRef<{ id: number; t: number } | null>(null);

  const trackPointer = (event: { pointerId: number; clientX: number; clientY: number }) => {
    svgRef.current?.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const interrupt = () => {
    stopCamera();
    if (touring) setTouring(false);
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
    interrupt();
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
      ox: viewRef.current.x,
      oy: viewRef.current.y,
      moved: false,
      threshold: event.pointerType === 'mouse' ? 4 : 10,
    };
  };

  const onNodeDown = (event: ReactPointerEvent<SVGGElement>, id: number) => {
    event.stopPropagation();
    interrupt();
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
      applyView({ k, x: midX - pinch.wx * k, y: midY - pinch.wy * k });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.sx;
    const dy = event.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > drag.threshold) drag.moved = true;
    if (!drag.moved) return;

    if (drag.kind === 'pan') {
      applyView({ ...viewRef.current, x: drag.ox + dx, y: drag.oy + dy });
      return;
    }
    const node = drag.id !== null ? nodesRef.current.get(drag.id) : undefined;
    if (!node) return;
    node.x = drag.ox + dx / viewRef.current.k;
    node.y = drag.oy + dy / viewRef.current.k;
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
      if (node && !drag.moved) node.fixed = false;
      if (!drag.moved) {
        const now = performance.now();
        const last = lastTapRef.current;
        if (last && last.id === drag.id && now - last.t < DOUBLE_TAP_MS) {
          lastTapRef.current = null;
          onOpenSheet(drag.id);
        } else {
          lastTapRef.current = { id: drag.id, t: now };
          setSelectedId(drag.id);
        }
      }
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

  const activeLane = activeId != null ? categoryKeyOf(sheetById.get(activeId)?.categoryId) : null;

  const toggleCategory = (key: string) =>
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedSheet = selectedId != null ? sheetById.get(selectedId) : undefined;
  const selectedVisible = selectedId != null && visibleIds.has(selectedId);
  const selectedColor = selectedSheet ? colorOfCategory(selectedSheet.categoryId) : FALLBACK_COLOR;

  const emptyMessage = isLoading
    ? 'Chargement du réseau…'
    : sheets.length === 0
      ? 'Aucune fiche pour le moment.'
      : visibleSheets.length === 0
        ? 'Aucune fiche à afficher avec ces filtres.'
        : null;

  return (
    <div
      ref={containerRef}
      className="relative min-h-[320px] w-full flex-1 overflow-hidden font-sans print:hidden"
      style={{ background: LOOM_BACKGROUND }}
    >
      <style>{CSS}</style>

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
        <defs>
          <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,1 L9,5 L0,9 z" fill="#fcd34d" />
          </marker>
        </defs>

        <g ref={worldRef}>
          {/* Fils de chaîne : une branche par catégorie */}
          {laneMode &&
            lanes.map((lane) => {
              const lit = activeLane === lane.key;
              const label = lane.name.length > 22 ? `${lane.name.slice(0, 21)}…` : lane.name;
              const width = Math.max(54, label.length * 6.4 + 26);
              return (
                <g key={lane.key} pointerEvents="none">
                  <line
                    ref={(el) => {
                      if (el) laneLineEls.current.set(lane.key, el);
                      else laneLineEls.current.delete(lane.key);
                    }}
                    x1={lane.x}
                    x2={lane.x}
                    stroke={lane.color}
                    strokeWidth={lit ? 2.5 : 1.5}
                    strokeOpacity={lit ? 0.7 : 0.28}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <g
                    ref={(el) => {
                      if (el) laneHeadEls.current.set(lane.key, el);
                      else laneHeadEls.current.delete(lane.key);
                    }}
                    opacity={lit ? 1 : 0.8}
                  >
                    <rect x={-width / 2} y={-11} width={width} height={22} rx={11} fill={INK} stroke={lane.color} strokeWidth={1.5} />
                    <circle cx={-width / 2 + 11} cy={0} r={3} fill={lane.color} />
                    <text x={-width / 2 + 20} y={3.5} fontSize={10.5} className="fill-amber-100" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      {label}
                    </text>
                  </g>
                </g>
              );
            })}

          {/* Fils de trame : les mentions */}
          {visibleLinks.map((link) => {
            const key = `${link.source}-${link.target}`;
            const s = nodesRef.current.get(link.source);
            const t = nodesRef.current.get(link.target);
            const d = s && t ? threadPath(s, t) : undefined;
            const hot = activeId != null && (link.source === activeId || link.target === activeId);
            const dim = (activeId != null && !hot) || (matches !== null && !(matches.has(link.source) && matches.has(link.target)));
            const width = 1.2 + Math.min(link.count, 5) * 0.5;
            const color = colorOfCategory(sheetById.get(link.source)?.categoryId);
            return (
              <g
                key={key}
                fill="none"
                strokeLinecap="round"
                pointerEvents="none"
                style={{ opacity: dim ? 0.1 : 1, transition: 'opacity .25s ease' }}
                ref={(el) => {
                  if (el) linkEls.current.set(key, el);
                  else linkEls.current.delete(key);
                }}
              >
                {/* Liseré sombre : donne l’effet « dessus / dessous » aux croisements */}
                <path d={d} stroke={INK} strokeOpacity={0.85} strokeWidth={width + 3} vectorEffect="non-scaling-stroke" />
                <path
                  d={d}
                  stroke={color}
                  strokeOpacity={hot ? 1 : 0.6}
                  strokeWidth={hot ? width + 1 : width}
                  vectorEffect="non-scaling-stroke"
                  markerEnd={hot ? `url(#${uid}-arrow)` : undefined}
                />
                {hot && (
                  <path d={d} pathLength={1} className="sn-draw" stroke="#fef3c7" strokeOpacity={0.85} strokeWidth={Math.max(1, width - 0.6)} vectorEffect="non-scaling-stroke" />
                )}
              </g>
            );
          })}

          {/* Fiches : des « commits » */}
          {visibleSheets.map((sheet, index) => {
            const sim = nodesRef.current.get(sheet.id);
            const radius = radiusOf(degree.get(sheet.id) ?? 0);
            const color = colorOfCategory(sheet.categoryId);
            const isCurrent = sheet.id === currentSheetId;
            const isSelected = sheet.id === selectedId;
            const isHover = sheet.id === hoverId;
            const isMatch = matches?.has(sheet.id) ?? false;
            const near = activeNeighbours.has(sheet.id);
            const dim = (activeId != null && !near) || (matches !== null && !isMatch);
            const keepLabel = near || isMatch || isCurrent;
            const scale = isHover ? 1.2 : isSelected ? 1.1 : 1;

            return (
              <g
                key={sheet.id}
                transform={sim ? `translate(${sim.x.toFixed(1)} ${sim.y.toFixed(1)})` : undefined}
                ref={(el) => {
                  if (el) nodeEls.current.set(sheet.id, el);
                  else nodeEls.current.delete(sheet.id);
                }}
                style={{ opacity: dim ? 0.2 : 1, transition: 'opacity .25s ease' }}
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
                <g className="sn-pop" style={{ animationDelay: `${Math.min(index * 15, 500)}ms` }}>
                  <g style={{ transform: `scale(${scale})`, transformOrigin: '0px 0px', transition: 'transform .2s ease-out' }}>
                    {(isHover || isSelected || isCurrent) && <circle r={radius + 8} fill={color} opacity={0.2} pointerEvents="none" />}
                    {(isSelected || isMatch) && (
                      <circle r={radius + 6} fill="none" className="stroke-amber-300" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />
                    )}
                    {isSelected && <circle key={`ping-${selectedId}`} r={radius + 3} fill="none" className="sn-ping stroke-amber-200" strokeWidth={2} pointerEvents="none" />}

                    {/* Point de commit : anneau coloré, cœur sombre (plein si fiche courante) */}
                    <circle r={radius} fill={isCurrent ? color : INK} stroke={color} strokeWidth={3} />
                    {!isCurrent && <circle r={radius * 0.42} fill={color} pointerEvents="none" />}
                  </g>
                </g>

                {isCurrent && (
                  <g pointerEvents="none" transform={`translate(0 ${-radius - 13})`}>
                    <rect x={-17} y={-8} width={34} height={16} rx={8} className="fill-amber-300" />
                    <text y={3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill={INK} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      HEAD
                    </text>
                  </g>
                )}

                <text
                  y={radius + 16}
                  textAnchor="middle"
                  fontSize={isHover ? 13 : 12}
                  fontWeight={isHover || isSelected ? 600 : 400}
                  className={`wv-label fill-amber-100 ${keepLabel ? 'wv-keep' : ''}`}
                  pointerEvents="none"
                  style={{ stroke: INK, strokeWidth: 3.5, paintOrder: 'stroke', strokeLinejoin: 'round' }}
                >
                  {sheet.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Vignette légère (dégradé statique) */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)' }}
      />

      {emptyMessage && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center font-serif text-amber-200/60">
          {emptyMessage}
        </p>
      )}

      {!emptyMessage && links.length === 0 && (
        <p className="pointer-events-none absolute inset-x-4 bottom-16 mx-auto max-w-md rounded-xl border border-amber-900/30 bg-neutral-950/90 px-4 py-3 text-center text-xs text-amber-200/70">
          Aucune mention entre fiches pour l’instant. Mentionne une fiche avec « @ » dans une carte, ou utilise « Détecter les fiches ».
        </p>
      )}

      {!emptyMessage && (
        <p className="sn-hint pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto hidden w-fit rounded-full border border-amber-900/30 bg-neutral-950/80 px-4 py-1.5 text-[11px] text-amber-200/70 sm:block">
          Glisser pour explorer · Molette pour zoomer · Double-clic sur une fiche pour l’ouvrir
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
          className={`${showFilters ? 'flex' : 'hidden'} max-h-[40dvh] flex-wrap gap-2 overflow-y-auto rounded-xl border border-amber-900/40 bg-neutral-950/95 p-2 sm:flex sm:max-h-none sm:flex-nowrap sm:overflow-x-auto sm:overflow-y-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:pb-1 sm:scrollbar-none`}
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
        <button type="button" onClick={() => zoomBy(1.4)} className={iconBtn} aria-label="Zoom avant" title="Zoom avant">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.4)} className={iconBtn} aria-label="Zoom arrière" title="Zoom arrière">−</button>
        <button type="button" onClick={() => void fitView(true)} className={iconBtn} aria-label="Tout afficher" title="Tout afficher">⤢</button>
        <button type="button" onClick={resetLayout} className={iconBtn} aria-label="Réorganiser le réseau" title="Réorganiser (libère les fiches déplacées)">↻</button>
        <button
          type="button"
          onClick={() => setLaneMode((value) => !value)}
          className={`${iconBtn} ${laneMode ? '!border-amber-600 !bg-amber-700 !text-amber-50' : ''}`}
          aria-pressed={laneMode}
          aria-label="Disposition en branches"
          title={laneMode ? 'Passer en disposition libre' : 'Ranger les fiches en branches par catégorie'}
        >
          ∥
        </button>
        <button
          type="button"
          onClick={() => setTouring((value) => !value)}
          disabled={visibleSheets.length < 2}
          className={`${iconBtn} ${touring ? '!border-amber-600 !bg-amber-700 !text-amber-50' : ''} disabled:cursor-default disabled:opacity-40`}
          aria-pressed={touring}
          aria-label={touring ? 'Arrêter la visite' : 'Lancer la visite guidée'}
          title={touring ? 'Arrêter la visite (Échap)' : 'Visite guidée des fiches les plus connectées'}
        >
          {touring ? '■' : '▶'}
        </button>
      </div>

      <p className={`pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 rounded-lg bg-neutral-950/80 px-2.5 py-1 text-[11px] text-amber-200/60 ${selectedSheet && selectedVisible ? 'hidden sm:block' : ''}`}>
        {visibleSheets.length} fiche{visibleSheets.length > 1 ? 's' : ''} · {visibleLinks.length} lien{visibleLinks.length > 1 ? 's' : ''}
      </p>

      {/* Détail de la fiche sélectionnée */}
      {selectedSheet && selectedVisible && (
        <div
          key={selectedSheet.id}
          className="sn-slide absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[45%] overflow-y-auto rounded-2xl border border-amber-900/40 bg-neutral-950/95 shadow-xl sm:inset-x-auto sm:left-3 sm:w-80"
        >
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${selectedColor}, transparent)` }} />
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-amber-200/60">
                  <span className="size-2 rounded-full" style={{ backgroundColor: selectedColor }} />
                  {categories.find((category) => category.id === selectedSheet.categoryId)?.name ?? 'Sans catégorie'}
                </p>
                <h3 className="truncate font-serif text-lg font-bold text-amber-100">{selectedSheet.name}</h3>
                <p className="mt-0.5 text-[11px] text-amber-200/50">
                  ↗ {adjacency.out.get(selectedSheet.id)?.length ?? 0} · ↙ {adjacency.incoming.get(selectedSheet.id)?.length ?? 0}
                </p>
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
                            interrupt();
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
        </div>
      )}
    </div>
  );
}

export default SheetNetwork;