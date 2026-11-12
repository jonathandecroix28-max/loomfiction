import type { Annotation } from './types';

const storageKey = (chapterId: number) => `loomfiction:annotations:${chapterId}`;

const isAnnotation = (value: unknown): value is Annotation => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Annotation>;
  return (
    typeof item.id === 'string' &&
    typeof item.start === 'number' &&
    typeof item.end === 'number' &&
    typeof item.exact === 'string' &&
    typeof item.color === 'string'
  );
};

export function loadAnnotations(chapterId: number): Annotation[] {
  try {
    const raw = localStorage.getItem(storageKey(chapterId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isAnnotation).map((item) => ({ ...item, note: item.note ?? '', prefix: item.prefix ?? '', suffix: item.suffix ?? '' }))
      : [];
  } catch {
    return [];
  }
}

export function saveAnnotations(chapterId: number, items: Annotation[]): boolean {
  try {
    if (items.length === 0) localStorage.removeItem(storageKey(chapterId));
    else localStorage.setItem(storageKey(chapterId), JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function newAnnotationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}