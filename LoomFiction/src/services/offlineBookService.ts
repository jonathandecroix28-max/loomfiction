import { bookService } from '../modules/books/services/bookService';
import type { BookResponse } from '../types/book';
import { newTempId, sortNewestFirst, remapBookId, isTempId } from '../db/loomfictionDb';
import { createOfflineRepository, nowIso, sameText } from '../db/Createofflinerepository';

type BookPayload = { title: string; description?: string; coverImage?: string };

const repo = createOfflineRepository<BookResponse, BookPayload>({
  entity: 'book',
  store: 'books',
  notFound: 'Livre introuvable.',
  remote: bookService,
  toPayload: ({ title, description, coverImage }) => ({ title, description, coverImage }),
  arrange: sortNewestFirst,

  // un livre local de même titre qu'un livre serveur = le même livre
  matchOnServer: (local, server) => server.find((s) => sameText(s.title, local.title)),

  // chapitres et idées du livre temporaire passent sur l'id serveur
  afterReplace: (tx, tempId, server) => remapBookId(tx, tempId, server.id),

  beforeRemove: async (tx, id) => {
    // les idées liées perdent leur livre
    const ideas = tx.objectStore('ideas');
    for (const idea of await ideas.index('by_book').getAll(id)) {
      await ideas.put({ ...idea, bookId: null });
    }
    // un livre jamais synchronisé emporte ses chapitres en attente
    if (isTempId(id)) {
      const chapters = tx.objectStore('chapters');
      for (const chapter of await chapters.index('by_book').getAll(id)) {
        await chapters.delete(chapter.id);
      }
    }
  },
});

export const offlineBookService = {
  getLocalBooks: repo.getLocal,
  getAll: repo.getAll,
  getById: repo.getById,
  syncToServer: repo.syncToServer,

  async create(title: string, description?: string, coverImage?: string): Promise<BookResponse[]> {
    const now = nowIso();
    await repo.insert({
      id: newTempId(),
      title,
      description,
      coverImage,
      createdAt: now,
      updatedAt: now,
      chapterCount: 0,
    });
    return repo.getLocal();
  },

  async update(id: number, title: string, description?: string, coverImage?: string): Promise<BookResponse[]> {
    await repo.patch(id, (book) => ({ ...book, title, description, coverImage, updatedAt: nowIso() }));
    return repo.getLocal();
  },

  async remove(id: number): Promise<BookResponse[]> {
    await repo.remove(id);
    return repo.getLocal();
  },
};