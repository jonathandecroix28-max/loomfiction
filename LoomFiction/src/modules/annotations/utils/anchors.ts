import type { Annotation } from './types';

export interface ResolvedAnnotation {
  annotation: Annotation;
  start: number;
  end: number;
}

const CONTEXT_LENGTH = 24;

export const normalizeQuote = (value: string) => value.replace(/[ \t\r\n]+/g, ' ').trim();

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


export function resolveAnnotations(fullText: string, annotations: Annotation[]): ResolvedAnnotation[] {
  const resolved: ResolvedAnnotation[] = [];

  for (const annotation of annotations) {
    const { start, end, exact, prefix, suffix } = annotation;

    if (fullText.slice(start, end) === exact) {
      resolved.push({ annotation, start, end });
      continue;
    }
    if (!exact) continue;

    let best = -1;
    let bestScore = -1;
    let bestDistance = Infinity;

    for (let from = fullText.indexOf(exact); from !== -1; from = fullText.indexOf(exact, from + 1)) {
      let score = 0;
      if (prefix && fullText.slice(Math.max(0, from - prefix.length), from) === prefix) score += 1;
      if (suffix && fullText.slice(from + exact.length, from + exact.length + suffix.length) === suffix) score += 1;
      const distance = Math.abs(from - start);

      if (score > bestScore || (score === bestScore && distance < bestDistance)) {
        best = from;
        bestScore = score;
        bestDistance = distance;
      }
    }

    if (best !== -1 && (bestScore > 0 || exact.length >= 20)) {
      resolved.push({ annotation, start: best, end: best + exact.length });
    }
  }

  return resolved.sort((a, b) => a.start - b.start || b.end - a.end);
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