import { ideaService } from '../modules/ideas/services/IdeaService';
import { offlineCategoryService } from './offlineCategoryService';
import { offlineBookService } from './offlineBookService';
import { offlineSheetService } from './offlineSheetService';
import type { IdeaResponse, IdeaUpsertRequest } from '../types/idea';
import {
  isTempId,
  newTempId,
  normalizeIdea,
  sortNewestFirst,
  remapIdeaId,
} from '../db/loomfictionDb';
import { createOfflineRepository, nowIso } from '../db/Createofflinerepository';

const bySortOrder = (a: IdeaResponse, b: IdeaResponse) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '');

const repo = createOfflineRepository<IdeaResponse, IdeaUpsertRequest>({
  entity: 'idea',
  store: 'ideas',
  notFound: 'Idée introuvable.',
  remote: ideaService,
  toPayload: (i) =>
    ({
      name: i.name,
      description: i.description,
      bookId: i.bookId ?? null,
      categoryId: i.categoryId,
      sheetId: i.sheetId ?? null,
      sortOrder: i.sortOrder,
      status: i.status || 'draft',
    }) as IdeaUpsertRequest,

  normalize: normalizeIdea,
  arrange: sortNewestFirst,

  // une idée attend que sa catégorie, son livre et sa fiche existent côté serveur
  dependsOnPending: (i) => isTempId(i.categoryId) || isTempId(i.bookId) || isTempId(i.sheetId),
  syncFirst: [
    () => offlineCategoryService.syncToServer(),
    () => offlineBookService.syncToServer(),
    () => offlineSheetService.syncToServer(),
  ],

  // les versions de l'idée temporaire passent sur l'id serveur
  afterReplace: (tx, tempId, server) => remapIdeaId(tx, tempId, server.id),

  // supprimer une idée supprime ses versions locales
  beforeRemove: async (tx, id) => {
    const versions = tx.objectStore('ideaVersions');
    for (const v of await versions.index('by_idea').getAll(id)) await versions.delete(v.id);
  },
});

export const offlineIdeaService = {
  getLocalIdeas: repo.getLocal,
  getAll: repo.getAll,
  getById: repo.getById,
  syncToServer: repo.syncToServer,

  async getByBookId(bookId: number): Promise<IdeaResponse[]> {
    await repo.getAll(); // rafraîchit si possible, sinon on garde le local
    return repo.byIndex('by_book', bookId);
  },

  /** Les cartes d'une fiche, dans l'ordre choisi. */
  async getBySheetId(sheetId: number): Promise<IdeaResponse[]> {
    await repo.getAll();
    return (await repo.byIndex('by_sheet', sheetId)).sort(bySortOrder);
  },

  async create(data: IdeaUpsertRequest): Promise<IdeaResponse[]> {
    const now = nowIso();
    await repo.insert({
      id: newTempId(),
      name: data.name,
      description: data.description,
      status: data.status || 'draft',
      bookId: data.bookId ?? null,
      categoryId: data.categoryId,
      sheetId: data.sheetId ?? null,
      sortOrder: data.sortOrder,
      createdAt: now,
      updatedAt: now,
    });
    return repo.getLocal();
  },

  async update(id: number, data: IdeaUpsertRequest): Promise<IdeaResponse[]> {
    await repo.patch(id, (idea) => ({
      ...idea,
      ...data,
      status: data.status ?? idea.status,
      bookId: data.bookId ?? null,
      // undefined = inchangé, null = détacher la carte de sa fiche
      sheetId: data.sheetId === undefined ? idea.sheetId ?? null : data.sheetId,
      sortOrder: data.sortOrder ?? idea.sortOrder,
      updatedAt: nowIso(),
    }));
    return repo.getLocal();
  },

  async remove(id: number): Promise<IdeaResponse[]> {
    await repo.remove(id);
    return repo.getLocal();
  },
};