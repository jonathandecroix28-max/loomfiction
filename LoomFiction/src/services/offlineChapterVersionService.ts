import { chapterVersionService } from '../modules/chapters/services/chapterVersionService';
import type { ChapterVersionResponse, ChapterVersionUpsertRequest } from '../types/chapterVersion';
import { offlineChapterService } from './offlineChapterService';
import { isTempId, newTempId, normalizeChapterVersion } from '../db/loomfictionDb';
import { createOfflineRepository, dedupeBy, nowIso } from '../db/Createofflinerepository';

const deduplicate = dedupeBy<ChapterVersionResponse>((v) => `${v.chapterId}-${v.versionNumber}`);

const arrangeVersions = (versions: ChapterVersionResponse[]) =>
  deduplicate(versions).sort((a, b) => Number(a.versionNumber) - Number(b.versionNumber));

const repo = createOfflineRepository<ChapterVersionResponse, ChapterVersionUpsertRequest>({
  entity: 'chapterVersion',
  store: 'chapterVersions',
  notFound: 'Version de chapitre introuvable.',
  remote: chapterVersionService,
  toPayload: (v) => ({
    chapterId: Number(v.chapterId),
    versionNumber: Number(v.versionNumber),
    name: v.name,
    content: v.content,
  }),

  normalize: normalizeChapterVersion,
  arrange: arrangeVersions,
  finalize: arrangeVersions,
  pendingPosition: 'end',

  // une version attend que son chapitre existe côté serveur
  dependsOnPending: (v) => isTempId(v.chapterId),
  syncFirst: [() => offlineChapterService.syncToServer()],

  // ne télécharge que les versions du chapitre demandé (et pas toutes, contenu compris)
  byParent: { index: 'by_chapter', fetch: chapterVersionService.getByChapterId },
});

export const offlineChapterVersionService = {
  getLocalVersions: repo.getLocal,
  getAll: repo.getAll,
  getById: repo.getById,
  getByChapterId: repo.getByParent,
  syncToServer: repo.syncToServer,

  async getByChapterIdAndNumber(chapterId: number, versionNumber: number): Promise<ChapterVersionResponse> {
    const versions = await repo.getByParent(chapterId);
    const version = versions.find((v) => Number(v.versionNumber) === Number(versionNumber));
    if (!version) throw new Error('Version de chapitre introuvable.');
    return version;
  },

  /** Numéro de la prochaine version d'un chapitre (dernier numéro local + 1). */
  async nextVersionNumber(chapterId: number): Promise<number> {
    const versions = await repo.byIndex('by_chapter', chapterId);
    return versions.reduce((max, v) => Math.max(max, Number(v.versionNumber)), 0) + 1;
  },

  async create(data: ChapterVersionUpsertRequest): Promise<ChapterVersionResponse[]> {
    const now = nowIso();
    await repo.insert({ id: newTempId(), ...data, createdAt: now, updatedAt: now });
    return repo.byIndex('by_chapter', data.chapterId);
  },

  async update(id: number, data: ChapterVersionUpsertRequest): Promise<ChapterVersionResponse[]> {
    const updated = await repo.patch(id, (version) => ({ ...version, ...data, updatedAt: nowIso() }));
    return repo.byIndex('by_chapter', updated.chapterId);
  },

  remove: repo.remove,
};