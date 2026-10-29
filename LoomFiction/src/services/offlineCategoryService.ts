import { categoryService } from '../modules/categories/services/categoryService';
import type { CategoryResponse, CategoryUpsertRequest } from '../types/category';
import { newTempId, sortNewestFirst, remapCategoryId } from '../db/loomfictionDb';
import { createOfflineRepository, nowIso, sameText } from '../db/Createofflinerepository';

const DEFAULT_COLOR = '#b45309';

const repo = createOfflineRepository<CategoryResponse, CategoryUpsertRequest>({
  entity: 'category',
  store: 'categories',
  notFound: 'Catégorie introuvable.',
  remote: categoryService,
  toPayload: ({ name, color, template }) => ({ name, color, template }),
  arrange: sortNewestFirst,

  matchOnServer: (local, server) => server.find((s) => sameText(s.name, local.name)),

  // les idées et les fiches de la catégorie temporaire passent sur l'id serveur
  afterReplace: (tx, tempId, server) => remapCategoryId(tx, tempId, server.id),

  // pas de catégorie orpheline : on refuse de supprimer une catégorie qui contient des idées ou des fiches
  beforeRemove: async (tx, id) => {
    const ideas = await tx.objectStore('ideas').index('by_category').count(id);
    const sheets = await tx.objectStore('sheets').index('by_category').count(id);
    if (ideas + sheets > 0) {
      throw new Error('Cette catégorie contient encore des idées ou des fiches et ne peut pas être supprimée.');
    }
  },

  deleteConflictMessage: 'Cette catégorie contient encore des idées et ne peut pas être supprimée.',
});

export const offlineCategoryService = {
  getLocalCategories: repo.getLocal,
  getAll: repo.getAll,
  getById: repo.getById,
  syncToServer: repo.syncToServer,

  async create(data: CategoryUpsertRequest): Promise<CategoryResponse[]> {
    const now = nowIso();
    await repo.insert({
      id: newTempId(),
      name: data.name,
      color: data.color || DEFAULT_COLOR,
      template: data.template,
      createdAt: now,
      updatedAt: now,
    });
    return repo.getLocal();
  },

  async update(id: number, data: CategoryUpsertRequest): Promise<CategoryResponse[]> {
    await repo.patch(id, (category) => ({
      ...category,
      name: data.name,
      color: data.color || DEFAULT_COLOR,
      template: data.template ?? category.template,
      updatedAt: nowIso(),
    }));
    return repo.getLocal();
  },

  /** Lève une erreur si la catégorie contient encore des idées ou des fiches. */
  async remove(id: number): Promise<CategoryResponse[]> {
    await repo.remove(id);
    return repo.getLocal();
  },
};