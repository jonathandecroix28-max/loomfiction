export type HighlightColor = 'amber' | 'rose' | 'green' | 'blue';

export const HIGHLIGHT_COLORS: ReadonlyArray<{ key: HighlightColor; label: string; swatch: string }> = [
  { key: 'amber', label: 'Ambre', swatch: '#f5b028' },
  { key: 'rose', label: 'Rose', swatch: '#ec6478' },
  { key: 'green', label: 'Vert', swatch: '#5ac282' },
  { key: 'blue', label: 'Bleu', swatch: '#6496f0' },
];

export const swatchOf = (color: HighlightColor) =>
  HIGHLIGHT_COLORS.find((item) => item.key === color)?.swatch ?? HIGHLIGHT_COLORS[0].swatch;


export interface Annotation {
  id: string;
  chapterId: number;
  bookId: number | null;
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
  quote: string;
  color: HighlightColor;
  note: string;
  createdAt: string;
  updatedAt: string;
}