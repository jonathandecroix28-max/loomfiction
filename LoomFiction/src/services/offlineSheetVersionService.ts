import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { IdeaResponse } from '../types/idea';
import type { SheetSnapshotCard, SheetVersion } from '../types/sheetVersion';


interface SheetVersionsDB extends DBSchema {
  versions: {
    key: number;
    value: SheetVersion;
    indexes: { by_sheet: number };
  };
}

let dbPromise: Promise<IDBPDatabase<SheetVersionsDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SheetVersionsDB>('loomfiction-sheet-versions', 1, {
      upgrade(db) {
        const store = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_sheet', 'sheetId');
      },
    });
  }
  return dbPromise;
}

const byOrder = (a: IdeaResponse, b: IdeaResponse) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export const offlineSheetVersionService = {
  async getAll(): Promise<SheetVersion[]> {
    return (await getDb()).getAll('versions');
  },

  async getBySheet(sheetId: number): Promise<SheetVersion[]> {
    return (await getDb()).getAllFromIndex('versions', 'by_sheet', sheetId);
  },

  async nextVersionNumber(sheetId: number): Promise<number> {
    const versions = await this.getBySheet(sheetId);
    return versions.reduce((max, version) => Math.max(max, Number(version.versionNumber)), 0) + 1;
  },

  /** Enregistre l'état actuel d'une fiche (nom + cartes dans l'ordre). */
  async createFromSheet(sheet: { id: number; name: string }, cards: IdeaResponse[]): Promise<SheetVersion> {
    const now = new Date().toISOString();
    const snapshot: SheetSnapshotCard[] = [...cards].sort(byOrder).map((card, position) => ({
      id: card.id,
      name: card.name,
      description: card.description ?? '',
      status: card.status,
      sortOrder: position,
      bookId: card.bookId ?? null,
      categoryId: card.categoryId,
    }));

    const draft: Omit<SheetVersion, 'id'> = {
      sheetId: sheet.id,
      versionNumber: await this.nextVersionNumber(sheet.id),
      name: sheet.name,
      cards: snapshot,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const id = await db.add('versions', draft as SheetVersion);
    return { ...draft, id: Number(id) };
  },

  async remove(id: number): Promise<boolean> {
    try {
      await (await getDb()).delete('versions', id);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression de la version de fiche :', error);
      return false;
    }
  },
};