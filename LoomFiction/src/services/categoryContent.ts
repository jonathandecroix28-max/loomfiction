import { offlineIdeaService } from './offlineIdeaService';
import { offlineSheetService } from './offlineSheetService';

export interface CategoryContent {
  sheets: number;
  cards: number;
  notes: number;
}

export async function countCategoryContent(categoryId: number): Promise<CategoryContent> {
  const [ideas, sheets] = await Promise.all([
    offlineIdeaService.getLocalIdeas(),
    offlineSheetService.getLocalSheets(),
  ]);
  const inCategory = ideas.filter((idea) => Number(idea.categoryId) === categoryId);

  return {
    sheets: sheets.filter((sheet) => Number(sheet.categoryId) === categoryId).length,
    cards: inCategory.filter((idea) => idea.sheetId != null).length,
    notes: inCategory.filter((idea) => idea.sheetId == null).length,
  };
}

/** Déplace les fiches (avec leurs cartes) et les notes libres vers une autre catégorie. */
export async function moveCategoryContent(fromId: number, toId: number): Promise<void> {
  const [ideas, sheets] = await Promise.all([
    offlineIdeaService.getLocalIdeas(),
    offlineSheetService.getLocalSheets(),
  ]);

  for (const sheet of sheets.filter((s) => Number(s.categoryId) === fromId)) {
    await offlineSheetService.update(sheet.id, { categoryId: toId });
  }
  for (const idea of ideas.filter((i) => Number(i.categoryId) === fromId)) {
    await offlineIdeaService.update(idea.id, {
      name: idea.name,
      description: idea.description,
      bookId: idea.bookId,
      categoryId: toId,
      status: idea.status,
    });
  }
}

/** Supprime les fiches (cartes comprises) et les notes d'une catégorie, mais pas la catégorie elle-même. */
export async function deleteCategoryContent(categoryId: number): Promise<void> {
  for (const sheet of (await offlineSheetService.getLocalSheets()).filter((s) => Number(s.categoryId) === categoryId)) {
    await offlineSheetService.remove(sheet.id); // emporte aussi ses cartes
  }
  for (const idea of (await offlineIdeaService.getLocalIdeas()).filter((i) => Number(i.categoryId) === categoryId)) {
    await offlineIdeaService.remove(idea.id);
  }
}