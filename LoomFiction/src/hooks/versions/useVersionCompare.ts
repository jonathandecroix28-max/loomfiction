import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildLineDiff,
  composeLineMerge,
  defaultLineChoices,
  mergeWithDefaults,
  type LineChoice,
  type LineChoices,
} from '../../utils/versions/lineDiff';

export type SortBy = 'newest' | 'oldest' | 'version';
export type CompareMode = 'current-left' | 'version-left';

export interface BaseVersion {
  id: number;
  versionNumber: number;
  name: string;
  updatedAt: string;
}


export function useParentItem<T>(id: number | null, load: (id: number) => Promise<T>) {
  const [result, setResult] = useState<{ id: number; item: T | null } | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    load(id)
      .then((value) => {
        if (!cancelled) setResult({ id, item: value });
      })
      .catch(() => {
        if (!cancelled) setResult({ id, item: null });
      });

    return () => {
      cancelled = true;
    };
  }, [id, load]);

  const item = id ? (result?.item ?? null) : null;
  const loading = !!id && result?.id !== id;

  return { item, loading };
}

interface Options<V extends BaseVersion> {
  versions: V[];
  selectedVersion: V | null;
  currentText: string;
  getText: (version: V) => string;
}


export function useVersionCompare<V extends BaseVersion>({
  versions,
  selectedVersion,
  currentText,
  getText,
}: Options<V>) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [compareMode, setCompareMode] = useState<CompareMode>('current-left');
  const visibleVersions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = versions.filter((version) => {
      if (!query) return true;
      return (
        version.name.toLowerCase().includes(query) ||
        String(version.versionNumber).includes(query) ||
        String(version.id).includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'version') return Number(b.versionNumber) - Number(a.versionNumber);
      const left = new Date(a.updatedAt).getTime();
      const right = new Date(b.updatedAt).getTime();
      return sortBy === 'newest' ? right - left : left - right;
    });
  }, [versions, search, sortBy]);

  const versionToCompare = selectedVersion ?? visibleVersions[0] ?? null;
  const versionText = versionToCompare ? getText(versionToCompare) : '';

  const rows = useMemo(() => buildLineDiff(currentText, versionText), [currentText, versionText]);

  const [choices, setChoices] = useState<LineChoices>(() => defaultLineChoices(rows));
  const [prevRows, setPrevRows] = useState(rows);
  if (prevRows !== rows) {
    setPrevRows(rows);
    setChoices(defaultLineChoices(rows));
  }

  const choose = useCallback((rowId: string, choice: LineChoice) => {
    setChoices((current) => ({ ...current, [rowId]: choice }));
  }, []);

  const mergedText = useMemo(() => composeLineMerge(rows, choices), [rows, choices]);


  const mergeFor = (version: V): string =>
    version.id === versionToCompare?.id ? mergedText : mergeWithDefaults(currentText, getText(version));

  return {
    search,
    setSearch,
    sortBy,
    setSortBy,
    compareMode,
    setCompareMode,
    visibleVersions,
    versionToCompare,
    rows,
    choices,
    choose,
    mergeFor,
  };
}