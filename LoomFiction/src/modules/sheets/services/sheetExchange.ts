import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import type { SheetResponse } from '../../../types/sheet';
import type { CategoryResponse } from '../../../types/category';
import type { IdeaResponse } from '../../../types/idea';
import DOMPurify from 'dompurify';



function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';

  const safeHtml = DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-type', 'data-id', 'data-label'],
  });
  const parsed = new DOMParser().parseFromString(safeHtml, 'text/html');

  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof Element)) return '';

    if (node.matches('[data-type="mention"]')) {
      const label = node.getAttribute('data-label')?.trim() || node.textContent?.trim() || '';
      return label ? `@${label.replace(/^@/, '')}` : '';
    }

    const content = Array.from(node.childNodes).map(inline).join('');
    switch (node.tagName.toLowerCase()) {
      case 'br': return '\n';
      case 'strong':
      case 'b': return content ? `**${content}**` : '';
      case 'em':
      case 'i': return content ? `*${content}*` : '';
      case 'code': return content ? `\`${content.replace(/`/g, '\\`')}\`` : '';
      case 'a': {
        const href = node.getAttribute('href')?.trim();
        return href ? `[${content}](${href})` : content;
      }
      default: return content;
    }
  };

  const block = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof Element)) return '';

    if (node.matches('[data-type="mention"]')) return inline(node);

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes);

    if (tag === 'br') return '\n';

    if (tag === 'ul' || tag === 'ol') {
      return children
        .filter((child): child is Element => child instanceof Element && child.tagName.toLowerCase() === 'li')
        .map((item, index) => {
          const text = Array.from(item.childNodes).map(block).join('').trim();
          return text ? `${tag === 'ol' ? `${index + 1}.` : '-'} ${text}` : '';
        })
        .filter(Boolean)
        .join('\n');
    }

    if (tag === 'li') return children.map(block).join('');

    if (tag === 'blockquote') {
      const text = children.map(block).join('').trim();
      return text ? text.split('\n').map((line) => `> ${line}`).join('\n') : '';
    }

    if (/^h[1-6]$/.test(tag)) {
      return `${'#'.repeat(Number(tag.slice(1)))} ${children.map(inline).join('').trim()}`;
    }

    if (['p', 'div', 'section'].includes(tag)) {
      return children.map((child) => {
        if (child instanceof Element && /^(ul|ol|blockquote)$/.test(child.tagName.toLowerCase())) {
          return block(child);
        }
        return inline(child);
      }).join('').trim();
    }

    return children.map((child) => {
      if (child instanceof Element && /^(p|div|section|ul|ol|blockquote|h[1-6])$/.test(child.tagName.toLowerCase())) {
        return block(child);
      }
      return inline(child);
    }).join('');
  };

  return Array.from(parsed.body.childNodes)
    .map(block)
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
      const description = htmlToMarkdown(card.description || '');
      lines.push(`## ${card.name}\n\n${description}\n`);
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