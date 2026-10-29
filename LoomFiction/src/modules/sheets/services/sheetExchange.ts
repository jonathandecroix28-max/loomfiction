import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import type { SheetResponse } from '../../../types/sheet';
import type { CategoryResponse } from '../../../types/category';
import type { IdeaResponse } from '../../../types/idea';

export interface ExportedSheetCard {
  name: string;
  description: string;
  sortOrder?: number;
}

export interface ExportedSheet {
  version: 1;
  type: 'loomfiction-sheet';
  name: string;
  categoryName?: string;
  cards: ExportedSheetCard[];
}


function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


export function exportSheetToJson(
  sheet: SheetResponse,
  category: CategoryResponse | null,
  cards: IdeaResponse[]
) {
  const data: ExportedSheet = {
    version: 1,
    type: 'loomfiction-sheet',
    name: sheet.name,
    categoryName: category?.name,
    cards: cards.map((card, index) => ({
      name: card.name,
      description: card.description || '',
      sortOrder: card.sortOrder ?? index,
    })),
  };

  const filename = `${sheet.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_fiche.json`;
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}


export function exportSheetToMarkdownFile(
  sheet: SheetResponse,
  category: CategoryResponse | null,
  cards: IdeaResponse[]
) {
  const lines: string[] = [
    `# ${sheet.name}`,
    category ? `*${category.name}*` : '',
    '',
  ];

  for (const card of cards) {
    if (card.description?.trim() || card.name) {
      lines.push(`## ${card.name}\n\n${(card.description || '').trim()}\n`);
    }
  }

  const filename = `${sheet.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_fiche.md`;
  downloadFile(lines.join('\n'), filename, 'text/markdown;charset=utf-8');
}


export function parseSheetContent(rawText: string): { name: string; cards: ExportedSheetCard[] } {
  const trimmed = rawText.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as ExportedSheet;
      if (parsed.name && Array.isArray(parsed.cards)) {
        return {
          name: parsed.name,
          cards: parsed.cards.map((c, idx) => ({
            name: c.name || `Carte ${idx + 1}`,
            description: c.description || '',
            sortOrder: c.sortOrder ?? idx,
          })),
        };
      }
    } catch {
      // Si échec JSON, continuer vers le Markdown
    }
  }

  const lines = trimmed.split('\n');
  let name = 'Fiche importée';
  const cards: ExportedSheetCard[] = [];
  let currentCard: ExportedSheetCard | null = null;

  for (const line of lines) {
    const titleMatch = line.match(/^#\s+(.+)$/);
    const cardMatch = line.match(/^##\s+(.+)$/);

    if (titleMatch) {
      name = titleMatch[1].trim();
    } else if (cardMatch) {
      if (currentCard) {
        currentCard.description = currentCard.description.trim();
        cards.push(currentCard);
      }
      currentCard = {
        name: cardMatch[1].trim(),
        description: '',
        sortOrder: cards.length,
      };
    } else if (currentCard) {
      if (currentCard.description === '' && line.trim().startsWith('*') && line.trim().endsWith('*')) {
        continue;
      }
      currentCard.description += line + '\n';
    }
  }

  if (currentCard) {
    currentCard.description = currentCard.description.trim();
    cards.push(currentCard);
  }

  return { name, cards };
}


export async function createSheetFromImport(
  importedData: { name: string; cards: ExportedSheetCard[] },
  categoryId: number,
  bookId: number | null = null
): Promise<SheetResponse> {
  const newSheet = await offlineSheetService.create({
    name: importedData.name,
    categoryId,
  });

  for (let i = 0; i < importedData.cards.length; i++) {
    const card = importedData.cards[i];
    await offlineIdeaService.create({
      name: card.name,
      description: card.description,
      categoryId,
      bookId,
      sheetId: newSheet.id,
      status: 'draft',
      sortOrder: card.sortOrder ?? i,
    });
  }

  return newSheet;
}