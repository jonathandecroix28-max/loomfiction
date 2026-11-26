import { matchPath } from 'react-router-dom';

export type ExplorerDomain = 'chapters' | 'sheets' | 'versions';
export type VersionRouteKind = 'chapter' | 'sheet' | 'idea' | 'hub';

export interface ExplorerRouteInfo {
  available: boolean;
  domain: ExplorerDomain;
  bookId: number | null;
  chapterId: number | null;
  sheetId: number | null;
  versionKind: VersionRouteKind;
  versionParentId: number | null;
  versionId: number | null;
}

const toNumber = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};


export function explorerRouteInfo(pathname: string): ExplorerRouteInfo {
  const info: ExplorerRouteInfo = {
    available: true,
    domain: 'chapters',
    bookId: null,
    chapterId: null,
    sheetId: null,
    versionKind: 'hub',
    versionParentId: null,
    versionId: null,
  };

  if (['/', '/terms', '/privacy', '/support'].includes(pathname) || pathname.includes('/read')) {
    return { ...info, available: false };
  }

  const params = (path: string) => matchPath({ path, end: true }, pathname)?.params;

  info.domain = pathname.includes('/versions') ? 'versions' : pathname.startsWith('/ideas') ? 'sheets' : 'chapters';

  const chapterVersions =
    params('/books/:bookId/chapters/:chapterId/versions/:versionId') ??
    params('/books/:bookId/chapters/:chapterId/versions');
  const chapter = chapterVersions ?? params('/books/:bookId/chapters/:chapterId');
  const book = params('/books/:id');
  const sheetVersions =
    params('/ideas/fiches/:sheetId/versions/:versionId') ?? params('/ideas/fiches/:sheetId/versions');
  const sheet = sheetVersions ?? params('/ideas/fiches/:sheetId');
  const ideaVersions = params('/ideas/:ideaId/versions/:versionId') ?? params('/ideas/:ideaId/versions');

  if (chapter) {
    info.bookId = toNumber(chapter.bookId);
    info.chapterId = toNumber(chapter.chapterId);
    info.versionKind = 'chapter';
    info.versionParentId = info.chapterId;
    info.versionId = toNumber(chapterVersions?.versionId);
  } else if (book) {
    info.bookId = toNumber(book.id);
  } else if (sheet) {
    info.sheetId = toNumber(sheet.sheetId);
    info.versionKind = 'sheet';
    info.versionParentId = info.sheetId;
    info.versionId = toNumber(sheetVersions?.versionId);
  } else if (ideaVersions) {
    info.versionKind = 'idea';
    info.versionParentId = toNumber(ideaVersions.ideaId);
    info.versionId = toNumber(ideaVersions.versionId);
  }

  return info;
}