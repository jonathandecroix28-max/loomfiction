import type { Annotation } from './types';

export type Resolution = 'same' | 'refresh' | 'moved' | 'edited';

export interface ResolvedAnnotation {
  annotation: Annotation;
  start: number;
  end: number;
  how: Resolution;
}

export interface ResolveResult {
  resolved: ResolvedAnnotation[];
  lost: Annotation[];
}

export interface AnchorPatch {
  id: string;
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
  quote?: string;
}

const CONTEXT_LENGTH = 24;
const HEAD_TAIL = 16;

export const normalizeQuote = (value: string) => value.replace(/[ \t\r\n]+/g, ' ').trim();

export function plainText(html: string): string {
  const holder = document.createElement('template');
  holder.innerHTML = html;
  return holder.content.textContent ?? '';
}

function offsetOf(root: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

export function rangeToOffsets(root: HTMLElement, range: Range): [number, number] {
  return [
    offsetOf(root, range.startContainer, range.startOffset),
    offsetOf(root, range.endContainer, range.endOffset),
  ];
}

export function anchorFor(fullText: string, start: number, end: number) {
  return {
    exact: fullText.slice(start, end),
    prefix: fullText.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: fullText.slice(end, end + CONTEXT_LENGTH),
  };
}


const contextScore = (text: string, from: number, to: number, a: Annotation) =>
  (a.prefix && text.slice(Math.max(0, from - a.prefix.length), from) === a.prefix ? 1 : 0) +
  (a.suffix && text.slice(to, to + a.suffix.length) === a.suffix ? 1 : 0);

function findMoved(text: string, a: Annotation): number | null {
  const { exact, start } = a;
  let best = -1;
  let bestScore = -1;
  let bestDistance = Infinity;

  for (let from = text.indexOf(exact); from !== -1; from = text.indexOf(exact, from + 1)) {
    const score = contextScore(text, from, from + exact.length, a);
    const distance = Math.abs(from - start);
    if (score > bestScore || (score === bestScore && distance < bestDistance)) {
      best = from;
      bestScore = score;
      bestDistance = distance;
    }
  }

  return best !== -1 && (bestScore > 0 || exact.length >= 20) ? best : null;
}

function findEdited(text: string, a: Annotation): { from: number; to: number } | null {
  const { exact, prefix, suffix, start } = a;

  if (exact.length >= 24) {
    const k = Math.min(HEAD_TAIL, Math.floor(exact.length / 3));
    const head = exact.slice(0, k);
    const tail = exact.slice(-k);
    const maxLength = Math.round(exact.length * 1.8) + 40;
    let best: { from: number; to: number; cost: number } | null = null;
    let tried = 0;

    for (let h = text.indexOf(head); h !== -1 && tried < 40; h = text.indexOf(head, h + 1), tried += 1) {
      for (let t = text.indexOf(tail, h + k); t !== -1 && t + k - h <= maxLength; t = text.indexOf(tail, t + 1)) {
        const to = t + k;
        const cost = Math.abs(to - h - exact.length) + Math.abs(h - start) * 0.01 - contextScore(text, h, to, a) * 40;
        if (!best || cost < best.cost) best = { from: h, to, cost };
      }
    }
    if (best) return { from: best.from, to: best.to };
  }

  if (prefix.length >= 12 && suffix.length >= 12) {
    const maxGap = Math.max(200, exact.length * 3);
    let best: { from: number; to: number } | null = null;

    for (let p = text.indexOf(prefix); p !== -1; p = text.indexOf(prefix, p + 1)) {
      const from = p + prefix.length;
      const s = text.indexOf(suffix, from);
      if (s === -1 || s - from < 3 || s - from > maxGap) continue;
      if (!best || Math.abs(from - start) < Math.abs(best.from - start)) best = { from, to: s };
    }
    if (best) return best;
  }

  return null;
}


export function resolveAnnotations(text: string, annotations: Annotation[]): ResolveResult {
  const resolved: ResolvedAnnotation[] = [];
  const lost: Annotation[] = [];

  for (const annotation of annotations) {
    const { start, end, exact } = annotation;

    if (!exact) {
      lost.push(annotation);
      continue;
    }

    if (text.slice(start, end) === exact) {
      const fresh = anchorFor(text, start, end);
      const same = fresh.prefix === annotation.prefix && fresh.suffix === annotation.suffix;
      resolved.push({ annotation, start, end, how: same ? 'same' : 'refresh' });
      continue;
    }

    const moved = findMoved(text, annotation);
    if (moved !== null) {
      resolved.push({ annotation, start: moved, end: moved + exact.length, how: 'moved' });
      continue;
    }

    const edited = findEdited(text, annotation);
    if (edited) {
      resolved.push({ annotation, start: edited.from, end: edited.to, how: 'edited' });
      continue;
    }

    lost.push(annotation);
  }

  resolved.sort((a, b) => a.start - b.start || b.end - a.end);
  return { resolved, lost };
}

export function toAnchorPatch(text: string, item: ResolvedAnnotation): AnchorPatch {
  const anchor = anchorFor(text, item.start, item.end);
  return {
    id: item.annotation.id,
    start: item.start,
    end: item.end,
    ...anchor,
    quote: item.how === 'edited' ? normalizeQuote(anchor.exact) : undefined,
  };
}


interface Segment {
  node: Text;
  from: number;
  to: number;
}

function textSegments(root: HTMLElement, start: number, end: number): Segment[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: Segment[] = [];
  let position = 0;

  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const node = current as Text;
    const length = node.data.length;
    const from = Math.max(start, position) - position;
    const to = Math.min(end, position + length) - position;

    if (to > from && node.data.slice(from, to).trim()) segments.push({ node, from, to });

    position += length;
    if (position >= end) break;
  }

  return segments;
}

function wrapSegment({ node, from, to }: Segment, annotation: Annotation, isLast: boolean) {
  if (to < node.data.length) node.splitText(to);
  const target = from > 0 ? node.splitText(from) : node;
  const parent = target.parentNode;
  if (!parent) return;

  const hasNote = annotation.note.trim().length > 0;
  const mark = document.createElement('mark');
  mark.className = 'annot';
  mark.dataset.annotationId = annotation.id;
  mark.dataset.hl = annotation.color;
  if (isLast && hasNote) mark.dataset.noteEnd = 'true';
  mark.tabIndex = 0;
  mark.setAttribute('role', 'button');
  mark.setAttribute('aria-label', hasNote ? 'Passage surligné, avec une note' : 'Passage surligné');

  parent.insertBefore(mark, target);
  mark.appendChild(target);
}

export function clearHighlights(root: HTMLElement) {
  root.querySelectorAll('mark.annot').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  root.normalize();
}

export function applyHighlights(root: HTMLElement, resolved: ResolvedAnnotation[]) {
  for (const { annotation, start, end } of resolved) {
    const segments = textSegments(root, start, end);
    segments.forEach((segment, index) => wrapSegment(segment, annotation, index === segments.length - 1));
  }
}