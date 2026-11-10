/**
 * Texte riche (HTML de l'éditeur) <-> phrases sans balises, pour les pages « Versions ».
 *
 * Les pages affichent et comparent des phrases ; la fusion, elle, doit rendre du HTML pour ne pas
 * perdre la mise en forme ni les mentions de fiches. On découpe donc le HTML en blocs (un paragraphe,
 * un titre, un élément de liste…) : le texte du bloc sert à comparer, son HTML d'origine sert à fusionner.
 */

export interface TextBlock {
  text: string;
  html: string;
}

const MENTION = '[data-type="mention"]';
const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE']);

export const looksLikeHtml = (value: string): boolean => /<\/?[a-z][^>]*>/i.test(value);

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function readText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element)) return '';
  if (node.tagName === 'BR') return ' ';
  if (node.matches(MENTION)) return node.getAttribute('data-label') || node.textContent || '';

  const inner = Array.from(node.childNodes).map(readText).join('');
  return BLOCK_TAGS.has(node.tagName) ? ` ${inner} ` : inner;
}

export function htmlToBlocks(html: string): TextBlock[] {
  if (!html.trim()) return [];

  const { body } = new DOMParser().parseFromString(html, 'text/html');
  const blocks: TextBlock[] = [];

  body.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = collapse(node.textContent ?? '');
      if (text) blocks.push({ text, html: `<p>${escapeHtml(text)}</p>` });
      return;
    }
    if (!(node instanceof Element)) return;

    if (node.tagName === 'UL' || node.tagName === 'OL') {
      const ordered = node.tagName === 'OL';
      const tag = ordered ? 'ol' : 'ul';
      Array.from(node.children).forEach((item, index) => {
        const text = collapse(readText(item));
        blocks.push({
          text: `${ordered ? `${index + 1}.` : '•'} ${text}`.trim(),
          html: `<${tag}>${item.outerHTML}</${tag}>`,
        });
      });
      return;
    }

    let text = collapse(readText(node));
    if (!text && (node.tagName === 'IMG' || node.querySelector('img'))) text = '[Image]';
    if (!text && node.tagName === 'HR') text = '───';

    blocks.push({ text, html: node.outerHTML });
  });

  return blocks;
}

export function htmlToText(value: string | null | undefined): string {
  const raw = (value ?? '').replace(/\r\n/g, '\n');
  if (!looksLikeHtml(raw)) return raw;
  return htmlToBlocks(raw)
    .map((block) => block.text)
    .join('\n');
}

function blockPool(raw: string): Map<string, string[]> {
  const pool = new Map<string, string[]>();
  const add = (text: string, html: string) => {
    const queue = pool.get(text);
    if (queue) queue.push(html);
    else pool.set(text, [html]);
  };

  if (looksLikeHtml(raw)) {
    htmlToBlocks(raw).forEach((block) => add(block.text, block.html));
  } else {
    raw.replace(/\r\n/g, '\n').split('\n').forEach((line) => add(line, `<p>${escapeHtml(line)}</p>`));
  }
  return pool;
}


export function textToHtml(merged: string, currentRaw: string, versionRaw: string): string {
  if (!looksLikeHtml(currentRaw) && !looksLikeHtml(versionRaw)) return merged;
  if (!merged) return '';

  const pools = [blockPool(currentRaw), blockPool(versionRaw)];

  const html = merged
    .split('\n')
    .map((line) => {
      for (const pool of pools) {
        const found = pool.get(line)?.shift();
        if (found !== undefined) return found;
      }
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('');

  return html.replace(/<\/ul><ul>/g, '').replace(/<\/ol><ol>/g, '');
}