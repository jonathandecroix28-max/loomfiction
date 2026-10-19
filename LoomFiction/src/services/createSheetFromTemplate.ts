import type { CategoryResponse } from '../types/category';
import type { SheetResponse } from '../types/sheet';
import { presetFor } from '../modules/categories/categoryPresets';
import { offlineSheetService } from './offlineSheetService';
import { offlineIdeaService } from './offlineIdeaService';

/** Modèle propre à la catégorie, sinon le préréglage correspondant à son nom, sinon rien. */
export function templateFor(category: CategoryResponse): string[] {
  return category.template?.length ? category.template : presetFor(category.name)?.template ?? [];
}

export async function createSheetFromTemplate(
  category: CategoryResponse,
  name: string,
  useTemplate = true
): Promise<SheetResponse> {
  const sheet = await offlineSheetService.create({ name: name.trim(), categoryId: category.id });
  if (!useTemplate) return sheet;

  const titles = templateFor(category);
  for (let i = 0; i < titles.length; i += 1) {
    await offlineIdeaService.create({
      name: titles[i],
      description: '',
      bookId: null,
      categoryId: category.id,
      sheetId: sheet.id,
      sortOrder: i,
      status: 'draft',
    });
  }
  return sheet;
}