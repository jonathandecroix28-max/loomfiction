import type { IdeaResponse } from '../../types/idea';

export interface GraphSheet {
  id: number;
  name: string;
}

export interface SheetLink {
  source: number;
  target: number;
  count: number;
}

export const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();

function extractMentions(html: string): Array<{ id: string | null; label: string }> {
  if (!html || !html.includes('mention')) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('[data-type="mention"]')).map((element) => ({
    id: element.getAttribute('data-id'),
    label: element.getAttribute('data-label')?.trim() || element.textContent?.trim() || '',
  }));
}


export function buildSheetGraph(sheets: GraphSheet[], ideas: IdeaResponse[]): SheetLink[] {
  const knownIds = new Set(sheets.map((sheet) => sheet.id));
  const idByName = new Map(sheets.map((sheet) => [normalizeName(sheet.name), sheet.id]));
  const counts = new Map<string, number>();

  for (const idea of ideas) {
    if (idea.sheetId == null || !knownIds.has(idea.sheetId)) continue;
    const source = idea.sheetId;

    for (const mention of extractMentions(idea.description ?? '')) {
      let target = idByName.get(normalizeName(mention.label));
      if (target == null && mention.id) {
        const numeric = Number(mention.id);
        if (knownIds.has(numeric)) target = numeric;
      }
      if (target == null || target === source) continue;

      const key = `${source}>${target}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([key, count]) => {
    const [source, target] = key.split('>').map(Number);
    return { source, target, count };
  });
}