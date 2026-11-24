import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'loomfiction-explorer-open';

function readStored(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}


let current = readStored();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setStored(value: boolean) {
  if (value === current) return;
  current = value;
  try {
    sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* stockage indisponible : l'état reste simplement partagé en mémoire */
  }
  listeners.forEach((listener) => listener());
}

export function useExplorerOpen() {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => current,
    () => false,
  );
  const setIsOpen = useCallback((value: boolean) => setStored(value), []);
  return [isOpen, setIsOpen] as const;
}