import { useCallback, useState } from 'react';

const STORAGE_KEY = 'loomfiction-explorer-open';

export function useExplorerOpen() {
  const [isOpen, setIsOpenState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setIsOpen = useCallback((value: boolean) => {
    setIsOpenState(value);
    try {
      sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* stockage indisponible : l'état reste simplement local */
    }
  }, []);

  return [isOpen, setIsOpen] as const;
}