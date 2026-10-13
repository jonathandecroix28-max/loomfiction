import { chapterService } from '../modules/chapters/services/chapterService';
import type { ChapterResponse } from '../types/chapter';
import { offlineBookService } from './offlineBookService';
import { isTempId, newTempId, normalizeChapter, remapChapterId } from '../db/loomfictionDb';
import { createOfflineRepository, dedupeBy, nowIso } from '../db/Createofflinerepository';

type ChapterPayload = { book_id: number; chapter_number: number; title: string; content: string };

// un livre ne peut avoir qu'un chapitre par numéro
const deduplicateChapters = dedupeBy<ChapterResponse>(
  (c) => `${Number(c.book_id)}-${Number(c.chapter_number)}`
);

const byChapterNumber = (a: ChapterResponse, b: ChapterResponse) =>
  Number(a.chapter_number) - Number(b.chapter_number);

const repo = createOfflineRepository<ChapterResponse, ChapterPayload>({
  entity: 'chapter',
  store: 'chapters',
  notFound: 'Chapitre introuvable.',
  remote: chapterService,
  toPayload: (c) => ({
    book_id: Number(c.book_id),
    chapter_number: Number(c.chapter_number),
    title: c.title,
    content: c.content ?? '',
  }),

  normalize: normalizeChapter,
  arrange: deduplicateChapters,
  finalize: deduplicateChapters,
  pendingPosition: 'end',

  // un chapitre attend que son livre existe côté serveur
  dependsOnPending: (c) => isTempId(c.book_id),
  syncFirst: [() => offlineBookService.syncToServer()],

  matchOnServer: (local, server) =>
    server.find(
      (s) =>
        Number(s.book_id) === Number(local.book_id) &&
        Number(s.chapter_number) === Number(local.chapter_number)
    ),

  afterReplace: async (tx, tempId, server) => {
    // le serveur gagne sur un emplacement (livre + numéro) occupé par un chapitre temporaire
    const store = tx.objectStore('chapters');
    const sameSlot = (await store.index('by_book').getAll(server.book_id)).filter(
      (c) =>
        c.id !== server.id &&
        isTempId(c.id) &&
        Number(c.chapter_number) === Number(server.chapter_number)
    );
    for (const c of sameSlot) await store.delete(c.id);
    // les versions du chapitre temporaire passent sur l'id serveur
    await remapChapterId(tx, tempId, server.id);
  },

  // supprimer un chapitre supprime ses versions locales
  beforeRemove: async (tx, id) => {
    const versions = tx.objectStore('chapterVersions');
    for (const v of await versions.index('by_chapter').getAll(id)) await versions.delete(v.id);
  },
});

const chaptersOfBook = async (bookId: number) =>
  (await repo.byIndex('by_book', bookId)).sort(byChapterNumber);

export const offlineChapterService = {
  getLocalChapters: repo.getLocal,
  getAll: repo.getAll,
  getById: repo.getById,
  syncToServer: repo.syncToServer,

  async getByBookId(bookId: number): Promise<ChapterResponse[]> {
    await repo.getAll(); // rafraîchit si possible, sinon on garde le local
    return chaptersOfBook(bookId);
  },

  async create(
    bookId: number,
    title: string,
    chapterNumber: number,
    content: string = ''
  ): Promise<ChapterResponse[]> {
    const now = nowIso();

    // emplacement déjà occupé : pas de doublon local, mais on tente quand même le serveur
    const slotTaken = (await repo.byIndex('by_book', bookId)).some(
      (c) => Number(c.chapter_number) === Number(chapterNumber)
    );

    await repo.insert(
      {
        id: newTempId(),
        book_id: bookId,
        title,
        content,
        chapter_number: chapterNumber,
        book_title: '',
        created_at: now,
        updated_at: now,
      },
      { persistLocal: !slotTaken }
    );

    return chaptersOfBook(bookId);
  },

  async update(id: number, title: string, content: string): Promise<ChapterResponse> {
    return repo.patch(id, (chapter) => ({ ...chapter, title, content, updated_at: nowIso() }));
  },

  /** true = supprimé aussi côté serveur (ou jamais synchronisé), false = en attente. */
  remove: repo.remove,
};