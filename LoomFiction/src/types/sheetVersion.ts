import type { IdeaStatus } from './idea';

export interface SheetSnapshotCard {
  id: number;
  name: string;
  description: string;
  status?: IdeaStatus;
  sortOrder: number;
  bookId: number | null;
  categoryId: number;
}

export interface SheetVersion {
  id: number;
  sheetId: number;
  versionNumber: number;
  name: string;
  cards: SheetSnapshotCard[];
  createdAt: string;
  updatedAt: string;
}