import { useEffect, useState } from 'react';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { bookOfSheet } from '../../sheets/sheetLinks';

export const ALLOW_UNATTACHED_SHEETS = true;

export type SheetBookMap = Map<number, number | null>;

export interface MentionScope {
  targetBookId: number | null;
  bookBySheet: SheetBookMap;
  ready: boolean;
}

export async function loadSheetBookMap(sheets: Array<{ id: number }>): Promise<SheetBookMap> {
  const entries = await Promise.all(
    sheets.map(async (sheet) => {
      const cards = await offlineIdeaService.getBySheetId(sheet.id);
      return [sheet.id, bookOfSheet(cards) ?? null] as const;
    }),
  );
  return new Map(entries);
}

export function isSheetMentionable(sheetId: number | string, scope: MentionScope): boolean {
  const id = Number(sheetId);
  if (!Number.isFinite(id) || !scope.ready || !scope.bookBySheet.has(id)) return false;

  const sheetBookId = scope.bookBySheet.get(id) ?? null;
  if (sheetBookId === null) return ALLOW_UNATTACHED_SHEETS;
  return sheetBookId === scope.targetBookId;
}

export function filterMentionableSheets<T extends { id: number }>(sheets: T[], scope: MentionScope): T[] {
  return sheets.filter((sheet) => isSheetMentionable(sheet.id, scope));
}

export function useSheetBookMap(sheets: Array<{ id: number }>): { bookBySheet: SheetBookMap; ready: boolean } {
  const [state, setState] = useState<{ bookBySheet: SheetBookMap; ready: boolean }>({
    bookBySheet: new Map(),
    ready: false,
  });

  useEffect(() => {
    if (sheets.length === 0) return;
    let cancelled = false;
    loadSheetBookMap(sheets)
      .then((bookBySheet) => {
        if (!cancelled) setState({ bookBySheet, ready: true });
      })
      .catch((err) => console.error('Erreur de chargement des romans des fiches :', err));
    return () => {
      cancelled = true;
    };
  }, [sheets]);

  return state;
}