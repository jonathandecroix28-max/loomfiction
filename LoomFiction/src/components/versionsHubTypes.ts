export interface VersionRow {
  key: string;
  parentKey: string;
  versionId: number;
  kind: 'chapter' | 'idea' | 'sheet';
  versionNumber: number;
  versionName: string;
  updatedAt: string;
  parentTitle: string;
  missing: boolean;
  bookId: number | null;
  chapterNumber?: number;
  categoryId?: number | null;
  sheetId?: number | null;
  cardCount?: number;
  openPath: string | null;
  parentEditorPath: string | null;
  rawTextContent: string;
  isRichText: boolean;
  sheetCardsSummary?: string[];
}


export interface FolderGroup {
  parentKey: string;
  parentTitle: string;
  missing: boolean;
  kind: 'chapter' | 'idea' | 'sheet';
  latestUpdatedAt: string;
  parentEditorPath: string | null;
  sampleRow: VersionRow;
  versions: VersionRow[]; 
}
