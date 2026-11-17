import { sheetService } from '../services/sheetService';
import type { SheetResponse, SheetUpsertRequest } from '../types/sheet';
import { offlineCategoryService } from './offlineCategoryService';
import { isTempId, newTempId, queueOp, remapSheetId, sortNewestFirst } from '../db/loomfictionDb';
import { createOfflineRepository, nowIso, sameText } from '../db/Createofflinerepository';

const repo = createOfflineRepository<SheetResponse, SheetUpsertRequest>({
  entity: 'sheet',
  store: 'sheets',
  notFound: 'Fiche introuvable.',
  remote: sheetService,
  toPayload: ({ name, categoryId }) => ({ name, categoryId }),
  arrange: sortNewestFirst,

  // une fiche attend que sa catégorie existe côté serveur
  dependsOnPending: (s) => isTempId(s.categoryId),
  syncFirst: [() => offlineCategoryService.syncToServer()],

  matchOnServer: (local, server) =>
    server.find((s) => Number(s.categoryId) === Number(local.categoryId) && sameText(s.name, local.name)),

  // les cartes de la fiche temporaire passent sur l'id serveur
  afterReplace: (tx, tempId, server) => remapSheetId(tx, tempId, server.id),

  // supprimer une fiche supprime ses cartes (et leurs versions locales)
  beforeRemove: async (tx, id) => {
    const ideas = tx.objectStore('ideas');
    const versions = tx.objectStore('ideaVersions');
    for (const idea of await ideas.index('by_sheet').getAll(id)) {
      for (const v of await versions.index('by_idea').getAll(idea.id)) await versions.delete(v.id);
      await ideas.delete(idea.id);
      await queueOp(tx, 'idea', 'delete', idea.id); // ignoré pour les ids temporaires
    }
  },
});

export const offlineSheetService = {
  getLocalSheets: repo.getLocal,
  getAll: repo.getAll,
  getById: repo.getById,
  syncToServer: repo.syncToServer,

  async getByCategoryId(categoryId: number): Promise<SheetResponse[]> {
    await repo.getAll(); // rafraîchit si possible, sinon on garde le local
    return repo.byIndex('by_category', categoryId);
  },

  /** Renvoie la fiche créée (id temporaire tant qu'elle n'est pas synchronisée). */
  create(data: SheetUpsertRequest): Promise<SheetResponse> {
    const now = nowIso();
    return repo.insert({
      id: newTempId(),
      name: data.name,
      categoryId: data.categoryId,
      createdAt: now,
      updatedAt: now,
    });
  },

  update(id: number, data: { name?: string; categoryId?: number }): Promise<SheetResponse> {
    return repo.patch(id, (sheet) => ({
      ...sheet,
      name: data.name ?? sheet.name,
      categoryId: data.categoryId ?? sheet.categoryId,
      updatedAt: nowIso(),
    }));
  },

  remove: repo.remove,
};