import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildLineDiff,
  composeLineMerge,
  defaultLineChoices,
  mergeWithDefaults,
  type LineChoice,
  type LineChoices,
} from '../../utils/versions/lineDiff';
import { htmlToText, textToHtml } from '../../utils/versions/htmlText';

export type SortBy = 'newest' | 'oldest' | 'version';
export type CompareMode = 'current-left' | 'version-left';

export interface BaseVersion {
  id: number;
  versionNumber: number;
  name: string;
  updatedAt: string;
}


export function useParentItem<T>(id: number | null, load: (id: number) => Promise<T>) {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!id);

  const [prev, setPrev] = useState({ id, load });
  if (prev.id !== id || prev.load !== load) {
    setPrev({ id, load });
    if (id) {
      setLoading(true);
    } else {
      setItem(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    load(id)
      .then((value) => {
        if (!cancelled) setItem(value);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, load]);

  return { item, loading };
}

interface Options<V extends BaseVersion> {
  versions: V[];
  selectedVersion: V | null;
  currentText: string;
  getText: (version: V) => string;
  richText?: boolean;
}


export function useVersionCompare<V extends BaseVersion>({
  versions,
  selectedVersion,
  currentText,
  getText,
  richText = false,
}: Options<V>) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [compareMode, setCompareMode] = useState<CompareMode>('current-left');
  const [choices, setChoices] = useState<LineChoices>({});

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

  const currentDiffText = richText ? htmlToText(currentText) : currentText;
  const versionDiffText = richText ? htmlToText(versionText) : versionText;

  const rows = useMemo(() => buildLineDiff(currentDiffText, versionDiffText), [currentDiffText, versionDiffText]);

  
  const [prevRows, setPrevRows] = useState<typeof rows | null>(null);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setChoices(defaultLineChoices(rows));
  }

  const choose = useCallback((rowId: string, choice: LineChoice) => {
    setChoices((current) => ({ ...current, [rowId]: choice }));
  }, []);

  const mergedText = useMemo(() => composeLineMerge(rows, choices), [rows, choices]);


  const mergeFor = (version: V): string => {
    const raw = getText(version);
    const plain =
      version.id === versionToCompare?.id
        ? mergedText
        : mergeWithDefaults(richText ? htmlToText(currentText) : currentText, richText ? htmlToText(raw) : raw);
    return richText ? textToHtml(plain, currentText, raw) : plain;
  };

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