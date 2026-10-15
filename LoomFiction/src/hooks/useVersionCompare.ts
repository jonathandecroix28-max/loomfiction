import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildLineDiff,
  composeLineMerge,
  defaultLineChoices,
  mergeWithDefaults,
  type LineChoice,
  type LineChoices,
} from '../utils/lineDiff';

export type SortBy = 'newest' | 'oldest' | 'version';
export type CompareMode = 'current-left' | 'version-left';

/** Ce que les pages « Versions » (chapitres, idées) ont en commun. */
export interface BaseVersion {
  id: number;
  versionNumber: number;
  name: string;
  updatedAt: string;
}

/**
 * Charge l'élément parent (chapitre, idée…) en suivant son état de chargement.
 * `load` doit être stable (méthode d'un service, pas une fonction recréée à chaque rendu).
 */
export function useParentItem<T>(id: number | null, load: (id: number) => Promise<T>) {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

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
  /** Texte actuel du chapitre / de l'idée. */
  currentText: string;
  /** Texte à comparer dans une version. Doit être stable (fonction définie hors du composant). */
  getText: (version: V) => string;
}

/**
 * Tout l'état du comparatif : filtre, tri, version comparée, diff ligne par ligne,
 * choix ligne par ligne et texte fusionné.
 */
export function useVersionCompare<V extends BaseVersion>({
  versions,
  selectedVersion,
  currentText,
  getText,
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

  const rows = useMemo(() => buildLineDiff(currentText, versionText), [currentText, versionText]);

  // Nouveau diff (autre version, texte modifié) : on repart des choix par défaut
  useEffect(() => {
    setChoices(defaultLineChoices(rows));
  }, [rows]);

  const choose = useCallback((rowId: string, choice: LineChoice) => {
    setChoices((current) => ({ ...current, [rowId]: choice }));
  }, []);

  const mergedText = useMemo(() => composeLineMerge(rows, choices), [rows, choices]);

  /**
   * Texte fusionné pour une version donnée :
   *  - la version comparée utilise les choix faits ligne par ligne,
   *  - une autre version (bouton « Fusionner » de la liste) utilise les choix par défaut.
   */
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