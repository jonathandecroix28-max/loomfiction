import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useSheets } from '../hooks/useSheets';
import { useIdeas } from '../../ideas/hooks/useIdeas';
import { useCategories } from '../../categories/hooks/useCategories';
import { useDataChanged } from '../../../hooks/useDataChanged';
import { offlineBookService } from '../../../services/offlineBookService';
import { fileToAvatar, useSheetImages } from '../hooks/useSheetImages';
import { buildSheetGraph, normalizeName } from '../sheetGraph';

interface SheetNetworkProps {
  currentSheetId: number | null;
  bookId?: number | null;
  books?: { id: number; title: string }[];
  onOpenSheet: (sheetId: number) => void;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
}

type Pos = { x: number; y: number; r: number; lane: string };
type Arc = { key: string; name: string; color: string; start: number; end: number; mid: number; count: number };
type Layout = { radius: number; positions: Map<number, Pos>; arcs: Arc[] };
type View = { x: number; y: number; k: number };
type Isolate = { id: number; depth: 1 | 2 };
type Drag = { id: number | null; sx: number; sy: number; ox: number; oy: number; moved: boolean; threshold: number };

const NO_CATEGORY = 'none';
const FALLBACK_COLOR = '#78716c';
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const ZOOM_FAR = 0.45;
const ZOOM_MID = 0.65;
const MIN_RING = 230;
const GROUP_GAP = 84;
const CENTER_R = 34;
const ARC_OFFSET = 34;

const PAGE = 'var(--c-page)';
const SURFACE = 'var(--c-surface)';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const nodeRadius = (degree: number) => 12 + Math.min(9, Math.sqrt(degree) * 2.4);
const fmt = (value: number) => value.toFixed(1);

const polar = (radius: number, angle: number) => ({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });

function arcPath(radius: number, start: number, end: number) {
  const a = polar(radius, start);
  const b = polar(radius, end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M${fmt(a.x)},${fmt(a.y)} A${fmt(radius)},${fmt(radius)} 0 ${large} 1 ${fmt(b.x)},${fmt(b.y)}`;
}


function ringPath(a: Pos, b: Pos, ring: number) {
  const inset = (p: Pos) => {
    const scale = Math.max(0.2, (ring - p.r - 4) / ring);
    return { x: p.x * scale, y: p.y * scale };
  };
  const p = inset(a);
  const q = inset(b);
  const cos = clamp((a.x * b.x + a.y * b.y) / (ring * ring), -1, 1);
  const pull = Math.pow(1 - Math.acos(cos) / Math.PI, 1.25);
  const cx = ((p.x + q.x) / 2) * pull;
  const cy = ((p.y + q.y) / 2) * pull;
  return `M${fmt(p.x)},${fmt(p.y)} Q${fmt(cx)},${fmt(cy)} ${fmt(q.x)},${fmt(q.y)}`;
}

/** Lien en éventail entre la fiche centrale et une fiche du cercle, légèrement courbé. */
function fanPath(from: { x: number; y: number; r: number }, to: { x: number; y: number; r: number }, sign: 1 | -1) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const sx = from.x + ux * (from.r + 3);
  const sy = from.y + uy * (from.r + 3);
  const ex = to.x - ux * (to.r + 5);
  const ey = to.y - uy * (to.r + 5);
  const offset = len * 0.14 * sign;
  const cx = (sx + ex) / 2 - uy * offset;
  const cy = (sy + ey) / 2 + ux * offset;
  return `M${fmt(sx)},${fmt(sy)} Q${fmt(cx)},${fmt(cy)} ${fmt(ex)},${fmt(ey)}`;
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-amber-900/30 bg-neutral-900/70 px-3 py-2 text-left transition active:bg-neutral-800"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-amber-100">{label}</span>
        {hint && <span className="block text-[11px] text-amber-200/50">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-amber-600' : 'bg-neutral-700'}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-amber-50 shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}

const chip = (active: boolean) =>
  `touch-target inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 font-sans text-xs transition ${
    active
      ? 'border-amber-600 bg-amber-700 text-amber-50'
      : 'border-amber-900/40 bg-neutral-900/90 text-amber-200/70 hover:bg-neutral-800'
  }`;

const iconBtn =
  'touch-target flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-amber-900/40 bg-neutral-900/90 font-sans text-base text-amber-200/80 shadow-md transition hover:bg-neutral-800 hover:text-amber-100 active:scale-95';

const stepBtn =
  'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-sm text-amber-200/80 transition hover:bg-neutral-800 hover:text-amber-100 disabled:cursor-default disabled:opacity-40';

const CSS = `
@keyframes sn-pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
@keyframes sn-ping{0%{transform:scale(.8);opacity:.8}100%{transform:scale(2.4);opacity:0}}
@keyframes sn-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes sn-slide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes sn-hint{0%,65%{opacity:1}100%{opacity:0}}
.sn-pop{transform-origin:0 0;animation:sn-pop .45s ease-out backwards}
.sn-ping{transform-origin:0 0;opacity:0;animation:sn-ping 1.1s ease-out forwards}
.sn-draw{stroke-dasharray:1;animation:sn-draw .6s ease-out both}
.sn-slide{animation:sn-slide .3s ease-out both}
.sn-hint{animation:sn-hint 9s ease forwards}
.wv-far .wv-label:not(.wv-keep){display:none}
.wv-mid .wv-label:not(.wv-keep):not(.wv-hub){display:none}
@media (prefers-reduced-motion: reduce){
  .sn-pop,.sn-ping,.sn-draw,.sn-slide,.sn-hint{animation:none!important}
}
`;

const LOOM_BACKGROUND = [
  'radial-gradient(ellipse 70% 70% at 50% 50%, color-mix(in srgb, var(--c-text-2) 9%, transparent), transparent 75%)',
  'radial-gradient(ellipse 90% 420px at 50% 0%, rgb(var(--c-glow) / var(--c-glow-a)), transparent 75%)',
  'var(--c-page)',
].join(', ');

export function SheetNetwork({ currentSheetId, bookId: bookIdProp, books, onOpenSheet, isImmersive = false, onToggleImmersive }: SheetNetworkProps) {
  const { sheets, refreshSheets } = useSheets();
  const { ideas, isLoading, refreshIdeas } = useIdeas(null);
  const { categories } = useCategories();
  const uid = useId().replace(/:/g, '');
  const { images, setImage } = useSheetImages();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<{ id: number; message: string } | null>(null);


  const [loadedBooks, setLoadedBooks] = useState<{ id: number; title: string }[]>([]);
  const loadBooks = useCallback(() => {
    offlineBookService
      .getAll()
      .then((list) => setLoadedBooks((list ?? []).map((book) => ({ id: book.id, title: book.title }))))
      .catch((err) => console.error('Erreur de chargement des romans :', err));
  }, []);
  useEffect(() => {
    loadBooks();
  }, [loadBooks]);
  const allBooks = useMemo(() => {
    const merged = new Map<number, string>();
    for (const book of loadedBooks) merged.set(book.id, book.title);
    for (const book of books ?? []) if (book.title) merged.set(book.id, book.title);
    return Array.from(merged, ([id, title]) => ({ id, title }));
  }, [loadedBooks, books]);

  useDataChanged(() => {
    void refreshSheets();
    void refreshIdeas();
    loadBooks();
  });

  const [query, setQuery] = useState('');
  const [hideIsolated, setHideIsolated] = useState(true);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(currentSheetId);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [touring, setTouring] = useState(false);
  const [minDegree, setMinDegree] = useState(0);
  const [strongOnly, setStrongOnly] = useState(false);
  const [isolateRaw, setIsolate] = useState<Isolate | null>(null);
  const [pickedBookId, setPickedBookId] = useState<number | null | undefined>(undefined);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const syncKey = `${currentSheetId ?? ''}|${bookIdProp ?? ''}`;
  const [appliedSyncKey, setAppliedSyncKey] = useState(syncKey);
  if (syncKey !== appliedSyncKey) {
    setAppliedSyncKey(syncKey);
    setSelectedId(currentSheetId);
    setPickedBookId(undefined);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showFilters) setShowFilters(false);
      else if (touring) setTouring(false);
      else if (isolateRaw) setIsolate(null);
      else if (isImmersive && onToggleImmersive) onToggleImmersive();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFilters, touring, isolateRaw, isImmersive, onToggleImmersive]);

  /* ───────────── Données du graphe ───────────── */

  /* ───────────── Roman actif ───────────── */

  const bookOptions = useMemo(() => {
    const ids = new Set<number | null>(ideas.map((idea) => idea.bookId ?? null));
    if (bookIdProp !== undefined) ids.add(bookIdProp);
    for (const book of allBooks) ids.add(book.id);
    return Array.from(ids).sort((a, b) => (a === null ? 1 : b === null ? -1 : a - b));
  }, [ideas, bookIdProp, allBooks]);

  const activeBook = useMemo<number | null>(() => {
    if (pickedBookId !== undefined && bookOptions.includes(pickedBookId)) return pickedBookId;
    if (bookIdProp !== undefined) return bookIdProp;
    if (currentSheetId != null) {
      const tally = new Map<number | null, number>();
      for (const idea of ideas) {
        if (idea.sheetId !== currentSheetId) continue;
        const book = idea.bookId ?? null;
        tally.set(book, (tally.get(book) ?? 0) + 1);
      }
      let best: number | null | undefined;
      let bestCount = 0;
      for (const [book, count] of tally) {
        if (count > bestCount) {
          best = book;
          bestCount = count;
        }
      }
      if (best !== undefined) return best;
    }
    return bookOptions[0] ?? null;
  }, [pickedBookId, bookIdProp, bookOptions, ideas, currentSheetId]);

  const bookTitleOf = useCallback(
    (id: number | null) =>
      id === null ? 'Sans roman' : (allBooks.find((book) => book.id === id)?.title ?? 'Roman sans titre'),
    [allBooks],
  );

  const changeBook = (next: number | null) => {
    if (next === activeBook) return;
    setPickedBookId(next);
    setIsolate(null);
    setSelectedId(null);
    setHoverId(null);
    setTouring(false);
  };

  const bookIdeas = useMemo(() => ideas.filter((idea) => (idea.bookId ?? null) === activeBook), [ideas, activeBook]);
  const allLinks = useMemo(() => buildSheetGraph(sheets, bookIdeas), [sheets, bookIdeas]);

  const scopedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const idea of bookIdeas) if (idea.sheetId != null) ids.add(idea.sheetId);
    for (const link of allLinks) {
      ids.add(link.source);
      ids.add(link.target);
    }
    return ids;
  }, [bookIdeas, allLinks]);

  const scopedSheets = useMemo(() => sheets.filter((sheet) => scopedIds.has(sheet.id)), [sheets, scopedIds]);

  const isolate = isolateRaw && scopedIds.has(isolateRaw.id) ? isolateRaw : null;

  const links = useMemo(() => (strongOnly ? allLinks.filter((link) => link.count >= 2) : allLinks), [allLinks, strongOnly]);

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

  const maxDegree = useMemo(() => Math.max(0, ...degree.values()), [degree]);
  const effectiveMinDegree = Math.min(minDegree, maxDegree);

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

  const neighbourhood = useMemo(() => {
    if (!isolate) return null;
    const adj = new Map<number, number[]>();
    for (const link of links) {
      adj.set(link.source, [...(adj.get(link.source) ?? []), link.target]);
      adj.set(link.target, [...(adj.get(link.target) ?? []), link.source]);
    }
    const seen = new Set<number>([isolate.id]);
    let frontier = [isolate.id];
    for (let level = 0; level < isolate.depth; level++) {
      const next: number[] = [];
      for (const id of frontier) {
        for (const other of adj.get(id) ?? []) {
          if (!seen.has(other)) {
            seen.add(other);
            next.push(other);
          }
        }
      }
      frontier = next;
    }
    return seen;
  }, [isolate, links]);

  const visibleSheets = useMemo(
    () =>
      scopedSheets.filter((sheet) => {
        if (neighbourhood) return neighbourhood.has(sheet.id);
        if (sheet.id === currentSheetId) return true;
        if (hiddenCategories.has(categoryKeyOf(sheet.categoryId))) return false;
        if (effectiveHideIsolated && !degree.get(sheet.id)) return false;
        if (effectiveMinDegree > 0 && (degree.get(sheet.id) ?? 0) < effectiveMinDegree) return false;
        return true;
      }),
    [scopedSheets, neighbourhood, currentSheetId, hiddenCategories, categoryKeyOf, effectiveHideIsolated, effectiveMinDegree, degree],
  );

  const visibleIds = useMemo(() => new Set(visibleSheets.map((sheet) => sheet.id)), [visibleSheets]);

  const visibleLinks = useMemo(
    () => links.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target)),
    [visibleIds, links],
  );

  const sheetById = useMemo(() => new Map(scopedSheets.map((sheet) => [sheet.id, sheet])), [scopedSheets]);

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
    () => new Set(scopedSheets.map((sheet) => categoryKeyOf(sheet.categoryId))),
    [scopedSheets, categoryKeyOf],
  );

  const hubThreshold = useMemo(() => {
    const values = visibleSheets.map((sheet) => adjacency.out.get(sheet.id)?.length ?? 0).map(
      (outDeg, index) => outDeg + (adjacency.incoming.get(visibleSheets[index].id)?.length ?? 0),
    );
    if (values.length === 0) return 2;
    values.sort((a, b) => a - b);
    return Math.max(2, values[Math.floor(values.length * 0.75)]);
  }, [visibleSheets, adjacency]);

  const lanes = useMemo(() => {
    const present = new Set(visibleSheets.map((sheet) => categoryKeyOf(sheet.categoryId)));
    const list: { key: string; name: string; color: string }[] = [];
    for (const category of categories) {
      if (present.has(String(category.id))) {
        list.push({ key: String(category.id), name: category.name, color: (category.color as string) || FALLBACK_COLOR });
      }
    }
    if (present.has(NO_CATEGORY)) list.push({ key: NO_CATEGORY, name: 'Sans catégorie', color: FALLBACK_COLOR });
    return list;
  }, [visibleSheets, categories, categoryKeyOf]);

  /* ───────────── Disposition : un grand cercle, un arc par catégorie ───────────── */

  const layout = useMemo<Layout>(() => {
    const buckets = lanes
      .map((lane) => {
        const members = visibleSheets
          .filter((sheet) => categoryKeyOf(sheet.categoryId) === lane.key)
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
        const width = members.reduce((sum, sheet) => sum + 2 * nodeRadius(degree.get(sheet.id) ?? 0) + 16, 0);
        return { lane, members, width };
      })
      .filter((bucket) => bucket.members.length > 0);

    if (buckets.length === 0) return { radius: MIN_RING, positions: new Map(), arcs: [] };

    const totalWidth = buckets.reduce((sum, bucket) => sum + bucket.width, 0);
    const radius = clamp((totalWidth + buckets.length * GROUP_GAP) / (2 * Math.PI), MIN_RING, 2400);
    const gapAngle = GROUP_GAP / radius;
    const available = Math.max(0.5, 2 * Math.PI - buckets.length * gapAngle);

    const positions = new Map<number, Pos>();
    const arcs: Arc[] = [];
    let cursor = -Math.PI / 2 + gapAngle / 2;

    for (const bucket of buckets) {
      const span = (available * bucket.width) / totalWidth;
      const start = cursor;
      const end = cursor + span;
      bucket.members.forEach((sheet, index) => {
        const angle = start + ((index + 0.5) / bucket.members.length) * span;
        const point = polar(radius, angle);
        positions.set(sheet.id, { ...point, r: nodeRadius(degree.get(sheet.id) ?? 0), lane: bucket.lane.key });
      });
      arcs.push({ ...bucket.lane, start, end, mid: (start + end) / 2, count: bucket.members.length });
      cursor = end + gapAngle;
    }
    return { radius, positions, arcs };
  }, [lanes, visibleSheets, degree, categoryKeyOf]);

  /* ───────────── Caméra ───────────── */

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const fittedRef = useRef(false);
  const camRef = useRef(0);
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 });
  const ringRef = useRef(layout.radius);

  useEffect(() => {
    ringRef.current = layout.radius;
  }, [layout.radius]);

  const applyView = useCallback((v: View) => {
    viewRef.current = v;
    worldRef.current?.setAttribute('transform', `translate(${v.x.toFixed(2)} ${v.y.toFixed(2)}) scale(${v.k.toFixed(4)})`);
    const svg = svgRef.current;
    if (svg) {
      svg.classList.toggle('wv-far', v.k <= ZOOM_FAR);
      svg.classList.toggle('wv-mid', v.k > ZOOM_FAR && v.k <= ZOOM_MID);
    }
  }, []);

  const stopCamera = useCallback(() => cancelAnimationFrame(camRef.current), []);

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

  /** Cadre tout le cercle (arcs et titres de catégories compris) dans la zone visible. */
  const fitView = useCallback(
    (animate = false) => {
      const el = containerRef.current;
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) return false;
      const bound = ringRef.current + ARC_OFFSET + 150;
      const k = clamp(Math.min(el.clientWidth, el.clientHeight) / (2 * bound), MIN_ZOOM, 1.2);
      flyTo(0, 0, k, animate ? 800 : 0);
      return true;
    },
    [flyTo],
  );

  const hasNodes = visibleSheets.length > 0;
  const fitKey = `${activeBook ?? 'none'}|${isolate ? `${isolate.id}:${isolate.depth}` : ''}`;

  useEffect(() => {
    if (!hasNodes) return;
    if (fitView(fittedRef.current)) fittedRef.current = true;
  }, [fitKey, layout.radius, hasNodes, fitView]);

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
      cancelAnimationFrame(camRef.current);
    },
    [],
  );

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

  const resetView = () => {
    setSelectedId(null);
    setHoverId(null);
    void fitView(true);
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
      timer = window.setTimeout(go, 3600);
    };
    timer = window.setTimeout(go, 0);
    return () => window.clearTimeout(timer);
  }, [touring, visibleSheets, degree]);

  /* ───────────── Gestes : déplacement, pincement, clic ───────────── */

  const dragRef = useRef<Drag | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; k: number; wx: number; wy: number } | null>(null);

  const trackPointer = (event: { pointerId: number; clientX: number; clientY: number }) => {
    svgRef.current?.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const interrupt = () => {
    stopCamera();
    if (touring) setTouring(false);
  };

  const beginPinch = () => {
    const el = containerRef.current;
    const [p1, p2] = Array.from(pointersRef.current.values());
    if (!el || !p1 || !p2) return;
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

  const startPan = (event: ReactPointerEvent<SVGElement>, id: number | null) => {
    interrupt();
    trackPointer(event);
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    dragRef.current = {
      id,
      sx: event.clientX,
      sy: event.clientY,
      ox: viewRef.current.x,
      oy: viewRef.current.y,
      moved: false,
      threshold: event.pointerType === 'mouse' ? 4 : 10,
    };
  };

  const onBackgroundDown = (event: ReactPointerEvent<SVGSVGElement>) => startPan(event, null);

  const onNodeDown = (event: ReactPointerEvent<SVGGElement>, id: number) => {
    event.stopPropagation();
    startPan(event, id);
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
    if (drag.moved) applyView({ ...viewRef.current, x: drag.ox + dx, y: drag.oy + dy });
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);

    if (pinchRef.current) {
      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
        const rest = Array.from(pointersRef.current.values())[0];
        const v = viewRef.current;
        dragRef.current = rest ? { id: null, sx: rest.x, sy: rest.y, ox: v.x, oy: v.y, moved: true, threshold: 0 } : null;
      }
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;

    if (drag.id === null) {
      setSelectedId(null);
    } else if (drag.id === selectedId && visibleIds.has(drag.id)) {
      // Un second clic sur la fiche déjà placée au centre l'ouvre.
      onOpenSheet(drag.id);
    } else {
      setSelectedId(drag.id);
    }
  };

  /* ───────────── Recherche / mise en avant ───────────── */

  const normalizedQuery = normalizeName(query);
  const matches = useMemo(() => {
    if (!normalizedQuery) return null;
    return new Set(
      visibleSheets.filter((sheet) => normalizeName(sheet.name).includes(normalizedQuery)).map((sheet) => sheet.id),
    );
  }, [normalizedQuery, visibleSheets]);

  /** La fiche sélectionnée vient se placer au centre du cercle. */
  const centerId = selectedId != null && visibleIds.has(selectedId) ? selectedId : null;
  const focusId = hoverId ?? centerId;

  const activeNeighbours = useMemo(() => {
    const set = new Set<number>();
    if (focusId == null) return set;
    set.add(focusId);
    for (const id of adjacency.out.get(focusId) ?? []) set.add(id);
    for (const id of adjacency.incoming.get(focusId) ?? []) set.add(id);
    return set;
  }, [focusId, adjacency]);

  const activeLanes = useMemo(() => {
    const set = new Set<string>();
    for (const id of activeNeighbours) {
      const lane = layout.positions.get(id)?.lane ?? categoryKeyOf(sheetById.get(id)?.categoryId);
      set.add(lane);
    }
    return set;
  }, [activeNeighbours, layout, categoryKeyOf, sheetById]);

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
  const selectedImage = selectedSheet
    ? (images[String(selectedSheet.id)] ?? (selectedSheet as { imageUrl?: string }).imageUrl)
    : undefined;

  const emptyMessage = isLoading
    ? 'Chargement du réseau…'
    : scopedSheets.length === 0
      ? 'Aucune fiche dans ce roman pour le moment.'
      : visibleSheets.length === 0
        ? 'Aucune fiche à afficher avec ces filtres.'
        : null;

  const activeFilterCount =
    (hideIsolated ? 0 : 1) + (strongOnly ? 1 : 0) + (effectiveMinDegree > 0 ? 1 : 0) + hiddenCategories.size;
  const resetFilters = () => {
    setHideIsolated(true);
    setStrongOnly(false);
    setMinDegree(0);
    setHiddenCategories(new Set());
  };

  const handleImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedSheet) return;
    try {
      const avatar = await fileToAvatar(file);
      if (setImage(selectedSheet.id, avatar)) setImageError(null);
      else setImageError({ id: selectedSheet.id, message: 'Stockage du navigateur plein : impossible d’enregistrer cette image.' });
    } catch (err) {
      setImageError({
        id: selectedSheet.id,
        message: err instanceof Error ? err.message : 'Impossible de charger cette image.',
      });
    }
  };

  const linkCount = visibleLinks.length;
  const dense = linkCount > 90;
  const veryDense = linkCount > 220;
  const restOpacity = veryDense ? 0.16 : dense ? 0.3 : 0.55;
  const dimOpacity = dense ? 0.03 : 0.07;
  const ring = layout.radius;
  const arcRadius = ring + ARC_OFFSET;
  const moveTransition = reducedMotion ? 'none' : 'transform .75s cubic-bezier(.22,1,.36,1), opacity .25s ease';

  const fanLinks = centerId === null ? [] : visibleLinks.filter((link) => link.source === centerId || link.target === centerId);
  const restLinks = centerId === null ? visibleLinks : visibleLinks.filter((link) => link.source !== centerId && link.target !== centerId);

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
          <clipPath id={`${uid}-avatar`} clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
          <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,1 L9,5 L0,9 z" style={{ fill: 'var(--c-a400)' }} />
          </marker>
        </defs>

        <g ref={worldRef}>
          {/* Anneaux discrets autour de la fiche centrale */}
          {centerId !== null && (
            <g pointerEvents="none" fill="none" stroke="var(--c-text-2)" strokeOpacity={0.12} vectorEffect="non-scaling-stroke">
              <circle r={ring * 0.55} strokeDasharray="2 6" />
              <circle r={ring - 46} />
            </g>
          )}

          {/* Arcs de catégories, avec leur titre à l'extérieur du cercle */}
          {layout.arcs.map((arc) => {
            const lit = focusId === null || activeLanes.has(arc.key);
            const cos = Math.cos(arc.mid);
            const sin = Math.sin(arc.mid);
            const label = arc.name.length > 24 ? `${arc.name.slice(0, 23)}…` : arc.name;
            const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
            const labelPos = polar(arcRadius + 18, arc.mid);
            const startDot = polar(arcRadius, arc.start);
            const endDot = polar(arcRadius, arc.end);
            return (
              <g key={arc.key} pointerEvents="none" style={{ opacity: lit ? 1 : 0.25, transition: 'opacity .3s ease' }}>
                <path d={arcPath(arcRadius, arc.start, arc.end)} fill="none" stroke={arc.color} strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" />
                <circle cx={startDot.x} cy={startDot.y} r={2.6} fill={arc.color} />
                <circle cx={endDot.x} cy={endDot.y} r={2.6} fill={arc.color} />
                <text
                  x={labelPos.x}
                  y={labelPos.y + (sin > 0.5 ? 12 : sin < -0.5 ? -4 : 4)}
                  textAnchor={anchor}
                  fontSize={14}
                  fontWeight={600}
                  className="fill-amber-100"
                  style={{ stroke: PAGE, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' }}
                >
                  {label}
                  <tspan fontSize={10.5} fontWeight={400} className="fill-amber-200/60" dx={6} style={{ fontFamily: MONO }}>
                    {arc.count}
                  </tspan>
                </text>
              </g>
            );
          })}

          {/* Liens entre fiches du cercle : des courbes qui plongent vers le centre */}
          {restLinks.map((link) => {
            const a = layout.positions.get(link.source);
            const b = layout.positions.get(link.target);
            if (!a || !b) return null;
            const key = `${link.source}-${link.target}`;
            const d = ringPath(a, b, ring);
            const hot = centerId === null && hoverId !== null && (link.source === hoverId || link.target === hoverId);
            const searchDim = matches !== null && !(matches.has(link.source) && matches.has(link.target));
            const dim = centerId !== null || (hoverId !== null && !hot) || searchDim;
            const width = (dense ? 0.9 : 1.1) + Math.min(link.count, 5) * 0.45;
            const color = colorOfCategory(sheetById.get(link.source)?.categoryId);
            return (
              <g
                key={key}
                fill="none"
                strokeLinecap="round"
                pointerEvents="none"
                style={{ opacity: dim ? dimOpacity : 1, transition: 'opacity .3s ease' }}
              >
                {(!veryDense || hot) && !dim && (
                  <path d={d} stroke={PAGE} strokeOpacity={0.6} strokeWidth={width + 2.5} vectorEffect="non-scaling-stroke" />
                )}
                <path
                  d={d}
                  stroke={hot ? 'var(--c-a400)' : color}
                  strokeOpacity={hot ? 1 : restOpacity}
                  strokeWidth={hot ? width + 1 : width}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {/* Liens de la fiche centrale : un éventail vers ses voisines */}
          {centerId !== null &&
            fanLinks.map((link) => {
              const outgoing = link.source === centerId;
              const other = layout.positions.get(outgoing ? link.target : link.source);
              if (!other) return null;
              const centre = { x: 0, y: 0, r: CENTER_R };
              const rim = { x: other.x, y: other.y, r: other.r };
              const d = fanPath(outgoing ? centre : rim, outgoing ? rim : centre, outgoing ? 1 : -1);
              const width = 1.3 + Math.min(link.count, 5) * 0.5;
              return (
                <g key={`${centerId}:${link.source}-${link.target}`} fill="none" strokeLinecap="round" pointerEvents="none">
                  <path d={d} stroke={PAGE} strokeOpacity={0.7} strokeWidth={width + 2.5} vectorEffect="non-scaling-stroke" />
                  <path
                    d={d}
                    pathLength={1}
                    className="sn-draw"
                    stroke={outgoing ? selectedColor : 'var(--c-heading)'}
                    strokeOpacity={outgoing ? 0.95 : 0.8}
                    strokeWidth={width}
                    vectorEffect="non-scaling-stroke"
                    markerEnd={`url(#${uid}-arrow)`}
                  />
                </g>
              );
            })}

          {/* Fiches */}
          {visibleSheets.map((sheet, index) => {
            const rim = layout.positions.get(sheet.id);
            if (!rim) return null;
            const isCenter = sheet.id === centerId;
            const x = isCenter ? 0 : rim.x;
            const y = isCenter ? 0 : rim.y;
            const nodeDegree = degree.get(sheet.id) ?? 0;
            const color = colorOfCategory(sheet.categoryId);
            const isCurrent = sheet.id === currentSheetId;
            const isHover = sheet.id === hoverId;
            const isMatch = matches?.has(sheet.id) ?? false;
            const near = activeNeighbours.has(sheet.id);
            const dim = (focusId !== null && !near) || (matches !== null && !isMatch);
            const keepLabel = near || isMatch || isCurrent;
            const isHub = nodeDegree >= hubThreshold;
            const shownRadius = isCenter ? CENTER_R : rim.r;
            const scale = isCenter ? CENTER_R / rim.r : isHover ? 1.18 : 1;
            const image = images[String(sheet.id)] ?? (sheet as { imageUrl?: string }).imageUrl;

            // Le nom se place vers l'extérieur du cercle pour ne pas recouvrir les fiches voisines.
            const ux = ring > 0 ? rim.x / ring : 0;
            const uy = ring > 0 ? rim.y / ring : 1;
            const labelX = isCenter ? 0 : ux * (rim.r + 8);
            const labelY = isCenter ? CENTER_R + 26 : uy * (rim.r + 8) + (uy > 0.5 ? 10 : uy < -0.5 ? -4 : 4);
            const labelAnchor = isCenter ? 'middle' : ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle';
            const labelText = !isCenter && sheet.name.length > 24 ? `${sheet.name.slice(0, 23)}…` : sheet.name;

            return (
              <g
                key={sheet.id}
                style={{
                  transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
                  transition: moveTransition,
                  opacity: dim ? 0.22 : 1,
                  filter: dim ? 'grayscale(0.8)' : undefined,
                }}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={sheet.name}
                aria-pressed={isCenter}
                onPointerDown={(event) => onNodeDown(event, sheet.id)}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setHoverId(sheet.id);
                }}
                onPointerLeave={() => setHoverId(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (isCenter) onOpenSheet(sheet.id);
                    else setSelectedId(sheet.id);
                  }
                }}
              >
                <circle r={shownRadius + 10} fill="transparent" />
                <g className="sn-pop" style={{ animationDelay: `${Math.min(index * 12, 500)}ms` }}>
                  <g style={{ transform: `scale(${scale})`, transformOrigin: '0px 0px', transition: reducedMotion ? 'none' : 'transform .6s cubic-bezier(.22,1,.36,1)' }}>
                    {(isCenter || isHover || (isCurrent && centerId === null)) && (
                      <circle r={rim.r + 8} fill={color} opacity={isCenter ? 0.3 : 0.22} pointerEvents="none" />
                    )}
                    {isMatch && <circle r={rim.r + 5} fill="none" className="stroke-amber-300" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />}
                    {isCenter && <circle key={`ping-${centerId}`} r={rim.r + 3} fill="none" className="sn-ping stroke-amber-200" strokeWidth={2} pointerEvents="none" />}

                    <circle r={rim.r} fill={isCurrent && !image ? color : SURFACE} />
                    {image ? (
                      <image
                        href={image}
                        x={-rim.r}
                        y={-rim.r}
                        width={rim.r * 2}
                        height={rim.r * 2}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#${uid}-avatar)`}
                        pointerEvents="none"
                      />
                    ) : (
                      <circle r={rim.r * 0.4} fill={isCurrent ? PAGE : color} pointerEvents="none" />
                    )}
                    <circle r={rim.r} fill="none" stroke={color} strokeWidth={3} />
                  </g>
                </g>

                {isCurrent && (
                  <g pointerEvents="none" transform={`translate(0 ${-shownRadius - 13})`}>
                    <rect x={-17} y={-8} width={34} height={16} rx={8} className="fill-amber-700" />
                    <text y={3.5} textAnchor="middle" fontSize={9} fontWeight={700} className="fill-amber-50" style={{ fontFamily: MONO }}>
                      HEAD
                    </text>
                  </g>
                )}

                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={labelAnchor}
                  fontSize={isCenter ? 20 : isHover ? 13 : 12}
                  fontWeight={isCenter || isHover ? 700 : 400}
                  className={`wv-label fill-amber-100 ${keepLabel || isCenter ? 'wv-keep' : ''} ${isHub ? 'wv-hub' : ''}`}
                  pointerEvents="none"
                  style={{ stroke: PAGE, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round', transition: 'all .3s ease' }}
                >
                  {labelText}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Vignette légère, teintée par le thème (--c-shadow) */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, var(--c-shadow) 100%)' }}
      />

      {emptyMessage && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center font-serif text-amber-200/60">
          {emptyMessage}
        </p>
      )}

      {!emptyMessage && links.length === 0 && (
        <p className="pointer-events-none absolute inset-x-4 bottom-16 mx-auto max-w-md rounded-xl border border-amber-900/30 bg-neutral-950/90 px-4 py-3 text-center text-xs text-amber-200/70">
          {allLinks.length === 0
            ? 'Aucune mention entre fiches pour l’instant. Mentionne une fiche avec « @ » dans une carte, ou utilise « Détecter les fiches ».'
            : 'Aucun lien ne répond au filtre « liens répétés ».'}
        </p>
      )}

      {!emptyMessage && !isolate && (
        <p className="sn-hint pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto hidden w-fit rounded-full border border-amber-900/30 bg-neutral-950/80 px-4 py-1.5 text-[11px] text-amber-200/70 sm:block">
          Cliquer une fiche pour la placer au centre · La cliquer à nouveau pour l’ouvrir · Molette pour zoomer
        </p>
      )}

      {/* Recherche, voisinage et filtres */}
      <div className="absolute left-3 right-16 top-[max(0.75rem,env(safe-area-inset-top))] flex max-w-2xl flex-col gap-2">
        {bookOptions.length > 1 && (
          <select
            value={activeBook === null ? 'none' : String(activeBook)}
            onChange={(event) => changeBook(event.target.value === 'none' ? null : Number(event.target.value))}
            aria-label="Roman affiché"
            className="hidden w-full cursor-pointer rounded-xl border border-amber-900/40 bg-neutral-900/90 px-3 py-2 text-xs text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:block sm:max-w-xs"
          >
            {bookOptions.map((id) => (
              <option key={id ?? 'none'} value={id === null ? 'none' : String(id)}>
                {bookTitleOf(id)}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !matches || matches.size === 0) return;
              const first = visibleSheets.find((sheet) => matches.has(sheet.id));
              if (first) setSelectedId(first.id);
            }}
            placeholder="Rechercher une fiche…"
            aria-label="Rechercher une fiche dans le réseau"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-amber-900/40 bg-neutral-900/90 px-3 py-2 text-base text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:min-h-0 sm:max-w-xs sm:text-xs"
          />
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            aria-haspopup="dialog"
            className={`${chip(showFilters || activeFilterCount > 0)} min-h-11 sm:hidden`}
          >
            Filtres
            {activeFilterCount > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-50 text-[11px] font-bold text-amber-900">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {isolate && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-[14rem] items-center truncate rounded-xl border border-amber-600 bg-amber-700 px-3 py-1.5 text-xs text-amber-50">
              ◎ {sheetById.get(isolate.id)?.name ?? `Fiche ${isolate.id}`}
            </span>
            {([1, 2] as const).map((depth) => (
              <button key={depth} type="button" onClick={() => setIsolate({ id: isolate.id, depth })} className={chip(isolate.depth === depth)} aria-pressed={isolate.depth === depth}>
                Niveau {depth}
              </button>
            ))}
            <button type="button" onClick={() => setIsolate(null)} className={chip(false)}>
              ✕ Tout afficher
            </button>
          </div>
        )}

        <div
          className="hidden items-center gap-2 sm:flex sm:flex-nowrap sm:overflow-x-auto sm:pb-1 sm:scrollbar-none"
        >
          <button type="button" onClick={() => setHideIsolated((value) => !value)} className={chip(effectiveHideIsolated)} aria-pressed={effectiveHideIsolated}>
            Masquer les fiches isolées
          </button>
          <button type="button" onClick={() => setStrongOnly((value) => !value)} className={chip(strongOnly)} aria-pressed={strongOnly} title="Ne garder que les mentions qui reviennent au moins deux fois">
            Liens répétés
          </button>
          <div className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-amber-900/40 bg-neutral-900/90 px-1.5 py-1 font-sans text-xs text-amber-200/80" title="Masquer les fiches ayant moins de connexions">
            <span className="whitespace-nowrap px-1">Connexions ≥ {effectiveMinDegree}</span>
            <button type="button" className={stepBtn} aria-label="Moins de connexions minimales" disabled={effectiveMinDegree <= 0} onClick={() => setMinDegree(Math.max(0, effectiveMinDegree - 1))}>
              −
            </button>
            <button type="button" className={stepBtn} aria-label="Plus de connexions minimales" disabled={effectiveMinDegree >= maxDegree} onClick={() => setMinDegree(Math.min(maxDegree, effectiveMinDegree + 1))}>
              +
            </button>
          </div>
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

      {/* Filtres (mobile) : panneau qui monte du bas de l'écran */}
      {showFilters && (
        <div className="absolute inset-0 z-30 sm:hidden" role="dialog" aria-modal="true" aria-label="Filtres du réseau">
          <button
            type="button"
            aria-label="Fermer les filtres"
            onClick={() => setShowFilters(false)}
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
          />
          <div className="sn-slide absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-3xl border-t border-amber-900/40 bg-neutral-950 shadow-2xl">
            <div className="flex shrink-0 flex-col items-center pt-2" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-amber-200/20" />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
              <h2 className="font-serif text-lg font-bold text-amber-100">Filtres</h2>
              <button
                type="button"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="touch-target cursor-pointer rounded-lg px-3 text-sm text-amber-200/80 transition hover:text-amber-100 disabled:cursor-default disabled:opacity-30"
              >
                Réinitialiser
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4">
              {bookOptions.length > 1 && (
                <section>
                  <h3 className="mb-2 text-[11px] uppercase tracking-[0.15em] text-amber-200/50">Roman</h3>
                  <select
                    value={activeBook === null ? 'none' : String(activeBook)}
                    onChange={(event) => changeBook(event.target.value === 'none' ? null : Number(event.target.value))}
                    aria-label="Roman affiché"
                    className="min-h-12 w-full cursor-pointer rounded-xl border border-amber-900/40 bg-neutral-900 px-3 text-base text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {bookOptions.map((id) => (
                      <option key={id ?? 'none'} value={id === null ? 'none' : String(id)}>
                        {bookTitleOf(id)}
                      </option>
                    ))}
                  </select>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-[11px] uppercase tracking-[0.15em] text-amber-200/50">Affichage</h3>
                <ToggleRow
                  label="Masquer les fiches isolées"
                  hint="Cache les fiches sans aucun lien"
                  checked={effectiveHideIsolated}
                  onChange={() => setHideIsolated((value) => !value)}
                />
                <ToggleRow
                  label="Liens répétés uniquement"
                  hint="Garde les mentions qui reviennent au moins 2 fois"
                  checked={strongOnly}
                  onChange={() => setStrongOnly((value) => !value)}
                />
                <div className="flex min-h-14 items-center gap-3 rounded-xl border border-amber-900/30 bg-neutral-900/70 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-amber-100">Connexions minimales</span>
                    <span className="block text-[11px] text-amber-200/50">Cache les fiches trop peu reliées</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="Moins de connexions minimales"
                      disabled={effectiveMinDegree <= 0}
                      onClick={() => setMinDegree(Math.max(0, effectiveMinDegree - 1))}
                      className="flex size-11 cursor-pointer items-center justify-center rounded-lg border border-amber-900/40 bg-neutral-900 text-lg text-amber-100 active:bg-neutral-800 disabled:cursor-default disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-mono text-base text-amber-100">{effectiveMinDegree}</span>
                    <button
                      type="button"
                      aria-label="Plus de connexions minimales"
                      disabled={effectiveMinDegree >= maxDegree}
                      onClick={() => setMinDegree(Math.min(maxDegree, effectiveMinDegree + 1))}
                      className="flex size-11 cursor-pointer items-center justify-center rounded-lg border border-amber-900/40 bg-neutral-900 text-lg text-amber-100 active:bg-neutral-800 disabled:cursor-default disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              </section>

              {(presentCategoryKeys.size > 0) && (
                <section>
                  <h3 className="mb-2 text-[11px] uppercase tracking-[0.15em] text-amber-200/50">Catégories</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories
                      .filter((category) => presentCategoryKeys.has(String(category.id)))
                      .map((category) => {
                        const key = String(category.id);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleCategory(key)}
                            className={`${chip(!hiddenCategories.has(key))} min-h-11 px-4 text-sm`}
                            aria-pressed={!hiddenCategories.has(key)}
                          >
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                            {category.name}
                          </button>
                        );
                      })}
                    {presentCategoryKeys.has(NO_CATEGORY) && (
                      <button
                        type="button"
                        onClick={() => toggleCategory(NO_CATEGORY)}
                        className={`${chip(!hiddenCategories.has(NO_CATEGORY))} min-h-11 px-4 text-sm`}
                        aria-pressed={!hiddenCategories.has(NO_CATEGORY)}
                      >
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: FALLBACK_COLOR }} />
                        Sans catégorie
                      </button>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="shrink-0 border-t border-amber-900/30 bg-neutral-950 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="touch-target min-h-12 w-full cursor-pointer rounded-xl border border-amber-600 bg-amber-700 px-4 text-sm font-medium text-amber-50 shadow-md transition active:bg-amber-600"
              >
                Voir {visibleSheets.length} fiche{visibleSheets.length > 1 ? 's' : ''} · {visibleLinks.length} lien{visibleLinks.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <button type="button" onClick={resetView} className={iconBtn} aria-label="Revenir à la vue d’ensemble" title="Vue d’ensemble (désélectionne la fiche centrale)">↻</button>
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
        {allBooks.some((book) => book.id === activeBook) ? `${bookTitleOf(activeBook)} · ` : ''}
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

            <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-900/30 bg-neutral-900/60 p-2">
              <span
                className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-900"
                style={{ boxShadow: `0 0 0 3px ${selectedColor}` }}
              >
                {selectedImage ? (
                  <img src={selectedImage} alt="" className="size-full object-cover" />
                ) : (
                  <span className="size-4 rounded-full" style={{ backgroundColor: selectedColor }} />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="min-h-9 cursor-pointer rounded-lg border border-amber-900/40 bg-neutral-900 px-2.5 text-xs text-amber-200 transition hover:bg-neutral-800"
                >
                  {selectedImage ? 'Changer l’image' : 'Ajouter une image'}
                </button>
                {selectedImage && images[String(selectedSheet.id)] && (
                  <button
                    type="button"
                    onClick={() => {
                      setImage(selectedSheet.id, null);
                      setImageError(null);
                    }}
                    className="min-h-9 cursor-pointer rounded-lg border border-amber-900/40 bg-neutral-900 px-2.5 text-xs text-amber-200/70 transition hover:bg-neutral-800"
                  >
                    Retirer
                  </button>
                )}
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
            </div>
            {imageError?.id === selectedSheet.id && (
              <p role="alert" className="-mt-1 mb-3 text-xs text-red-300/80">
                {imageError.message}
              </p>
            )}

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

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() =>
                  isolate?.id === selectedSheet.id
                    ? setIsolate(null)
                    : setIsolate({ id: selectedSheet.id, depth: isolate?.depth ?? 1 })
                }
                className={`${chip(isolate?.id === selectedSheet.id)} w-full justify-center`}
                aria-pressed={isolate?.id === selectedSheet.id}
                title="N’afficher que cette fiche et ses voisines"
              >
                {isolate?.id === selectedSheet.id ? '✕ Quitter le voisinage' : '◎ Isoler le voisinage'}
              </button>
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
        </div>
      )}
    </div>
  );
}

export default SheetNetwork;