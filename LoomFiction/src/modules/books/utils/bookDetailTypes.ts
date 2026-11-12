import type { ChapterVersionResponse } from '../../../types/chapterVersion';

export type SelectableVersionItem =
  | { kind: 'current'; id: 'current'; label: string; name: string; content: string; updatedAt: string; createdAt: string }
  | { kind: 'archive'; id: number; label: string; raw: ChapterVersionResponse };