import { offlineIdeaService } from '../../services/offlineIdeaService';
import type { IdeaResponse, IdeaUpsertRequest } from '../../types/idea';
import type { SheetResponse } from '../../types/sheet';

/** Minuscules sans accents : « Élara » est trouvé en tapant « elara ». */
export const foldText = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const toUpsert = (card: IdeaResponse): IdeaUpsertRequest => ({
  name: card.name,
  description: card.description,
  bookId: card.bookId,
  categoryId: card.categoryId,
  status: card.status,
  sortOrder: card.sortOrder,
});

/**
 * Le roman d'une fiche = celui de ses cartes (une fiche n'a pas de champ « roman » propre).
 * En cas de désaccord entre cartes, le roman le plus fréquent l'emporte.
 */
export function bookOfSheet(cards: IdeaResponse[]): number | null {
  const counts = new Map<number, number>();
  for (const card of cards) {
    if (card.bookId != null) counts.set(card.bookId, (counts.get(card.bookId) ?? 0) + 1);
  }

  let best: number | null = null;
  let bestCount = 0;
  counts.forEach((count, id) => {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  });
  return best;
}

/** Rattache toutes les cartes d'une fiche à un roman (ou les en détache avec null). */
export async function setSheetBook(cards: IdeaResponse[], bookId: number | null): Promise<void> {
  for (const card of cards) {
    if ((card.bookId ?? null) !== bookId) {
      await offlineIdeaService.update(card.id, { ...toUpsert(card), bookId });
    }
  }
}

/**
 * Transforme des notes libres en cartes d'une fiche :
 * elles prennent la catégorie de la fiche, son roman (s'il y en a un) et se placent à la suite.
 */
export async function attachIdeasToSheet(
  sheet: SheetResponse,
  cards: IdeaResponse[],
  ideas: IdeaResponse[]
): Promise<void> {
  const sheetBook = bookOfSheet(cards);
  let order = cards.reduce((max, card) => Math.max(max, card.sortOrder ?? -1), -1) + 1;

  for (const idea of ideas) {
    await offlineIdeaService.update(idea.id, {
      ...toUpsert(idea),
      categoryId: sheet.categoryId,
      bookId: sheetBook ?? idea.bookId ?? null,
      sheetId: sheet.id,
      sortOrder: order,
    });
    order += 1;
  }
}