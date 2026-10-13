import { ideaVersionService } from '../modules/ideas/services/IdeaVersionService';
import type { IdeaVersionResponse, IdeaVersionUpsertRequest } from '../types/ideaVersion';
import { offlineIdeaService } from './offlineIdeaService';
import { isTempId, newTempId, normalizeIdeaVersion } from '../db/loomfictionDb';
import { createOfflineRepository, dedupeBy, nowIso } from '../db/Createofflinerepository';

const deduplicate = dedupeBy<IdeaVersionResponse>((v) => `${v.ideaId}-${v.versionNumber}`);

const arrangeVersions = (versions: IdeaVersionResponse[]) =>
  deduplicate(versions).sort((a, b) => Number(a.versionNumber) - Number(b.versionNumber));

const repo = createOfflineRepository<IdeaVersionResponse, IdeaVersionUpsertRequest>({
  entity: 'ideaVersion',
  store: 'ideaVersions',
  notFound: 'Version d’idée introuvable.',
  remote: ideaVersionService,
  toPayload: (v) => ({
    ideaId: Number(v.ideaId),
    versionNumber: Number(v.versionNumber),
    name: v.name,
    description: v.description,
  }),

  normalize: normalizeIdeaVersion,
  arrange: arrangeVersions,
  finalize: arrangeVersions,
  pendingPosition: 'end',

  // une version attend que son idée existe côté serveur
  dependsOnPending: (v) => isTempId(v.ideaId),
  syncFirst: [() => offlineIdeaService.syncToServer()],

  // ne télécharge que les versions de l'idée demandée
  byParent: { index: 'by_idea', fetch: ideaVersionService.getByIdeaId },
});

export const offlineIdeaVersionService = {
  getLocalVersions: repo.getLocal,
  getAll: repo.getAll,
  getById: repo.getById,
  getByIdeaId: repo.getByParent,
  syncToServer: repo.syncToServer,

  async getByIdeaIdAndNumber(ideaId: number, versionNumber: number): Promise<IdeaVersionResponse> {
    const versions = await repo.getByParent(ideaId);
    const version = versions.find((v) => Number(v.versionNumber) === Number(versionNumber));
    if (!version) throw new Error('Version d’idée introuvable.');
    return version;
  },

  /** Numéro de la prochaine version d'une idée (dernier numéro local + 1). */
  async nextVersionNumber(ideaId: number): Promise<number> {
    const versions = await repo.byIndex('by_idea', ideaId);
    return versions.reduce((max, v) => Math.max(max, Number(v.versionNumber)), 0) + 1;
  },

  async create(data: IdeaVersionUpsertRequest): Promise<IdeaVersionResponse[]> {
    const now = nowIso();
    await repo.insert({ id: newTempId(), ...data, createdAt: now, updatedAt: now });
    return repo.byIndex('by_idea', data.ideaId);
  },

  async update(id: number, data: IdeaVersionUpsertRequest): Promise<IdeaVersionResponse[]> {
    const updated = await repo.patch(id, (version) => ({ ...version, ...data, updatedAt: nowIso() }));
    return repo.byIndex('by_idea', updated.ideaId);
  },

  remove: repo.remove,
};