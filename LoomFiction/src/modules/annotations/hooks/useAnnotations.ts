import { useCallback, useState } from 'react';
import { loadAnnotations, saveAnnotations } from '../utils/annotationStore';
import type { Annotation } from '../utils/types';

export type AnnotationPatch = Partial<Pick<Annotation, 'color' | 'note'>>;

export function useAnnotations(chapterId: number) {
  const [state, setState] = useState(() => ({ chapterId, items: loadAnnotations(chapterId) }));

  let items = state.items;
  if (state.chapterId !== chapterId) {
    items = loadAnnotations(chapterId);
    setState({ chapterId, items });
  }

  const commit = useCallback(
    (next: Annotation[]) => {
      setState({ chapterId, items: next });
      return saveAnnotations(chapterId, next);
    },
    [chapterId],
  );

  const add = useCallback((annotation: Annotation) => commit([...items, annotation]), [commit, items]);

  const update = useCallback(
    (id: string, patch: AnnotationPatch) =>
      commit(
        items.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
        ),
      ),
    [commit, items],
  );

  const remove = useCallback((id: string) => commit(items.filter((item) => item.id !== id)), [commit, items]);

  return { annotations: items, add, update, remove };
}