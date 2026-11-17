import { useCallback, useLayoutEffect, useRef } from 'react';

export function useLatestGetter<T>(value: T): () => T {
  const latest = useRef(value);

  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);

  return useCallback(() => latest.current, []);
}