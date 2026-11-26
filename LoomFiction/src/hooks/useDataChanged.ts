import { useEffect, useRef } from 'react';

export const DATA_CHANGED_EVENT = 'loomfiction-data-changed';


export function notifyDataChanged(source?: string) {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { source } }));
}

export function useDataChanged(listener: (source?: string) => void) {
  const listenerRef = useRef(listener);

  useEffect(() => {
    listenerRef.current = listener;
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string } | null>).detail;
      listenerRef.current(detail?.source);
    };
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, []);
}