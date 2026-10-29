const HTML_TAG = /<\/?[a-z][^>]*>/i;
const HTML_ENTITY = /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i;
const UNSAFE_HTML_TAGS = /<(script|style|iframe|object|embed|svg|math)\b[^>]*>([\s\S]*?)<\/\1>|<(script|style|iframe|object|embed|svg|math)\b[^>]*\/?>/gi;

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'figure', 'figcaption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'tr',
]);

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export function looksLikeHtml(text: string): boolean {
  return HTML_TAG.test(text);
}

function stripTagsFallback(html: string): string {
   let sanitized = html.replace(UNSAFE_HTML_TAGS, ' ');
   let previous: string;
   do {
     previous = sanitized;
     sanitized = sanitized.replace(UNSAFE_HTML_TAGS, ' ');
   } while (sanitized !== previous);
   return sanitized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n* * *\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}


export function htmlToPlainText(html: string): string {
  if (!html) return '';

  // Texte brut sans balise ni entité : rien à nettoyer
  if (!looksLikeHtml(html) && !HTML_ENTITY.test(html)) return html;

  if (typeof DOMParser === 'undefined') {
    return stripTagsFallback(html).replace(/\n{3,}/g, '\n\n').trim();
  }

  const body = new DOMParser().parseFromString(html, 'text/html').body;
  let out = '';

  const walk = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      out += (node.textContent ?? '').replace(/\s+/g, ' ');
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;

    const element = node as Element;
    const tag = element.tagName.toLowerCase();

    if (tag === 'script' || tag === 'style') return;
    if (tag === 'br') {
      out += '\n';
      return;
    }
    if (tag === 'hr') {
      out += '\n* * *\n';
      return;
    }
    if (tag === 'img') {
      out += '[image]';
      return;
    }

    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) out += '\n';

    if (tag === 'li') {
      const parent = element.parentElement;
      const ordered = parent?.tagName.toLowerCase() === 'ol';
      out += ordered ? `${Array.from(parent!.children).indexOf(element) + 1}. ` : '• ';
    }

    element.childNodes.forEach(walk);

    if (isBlock) out += '\n';
  };

  walk(body);

  return out
    .replace(/[ \t]+\n/g, '\n') // espaces en fin de ligne
    .replace(/\n[ \t]+/g, '\n') // espaces en début de ligne
    .replace(/\n{3,}/g, '\n\n') // pas plus d'une ligne vide d'affilée
    .trim();
}


export function displayLine(line: string): string {
  return htmlToPlainText(line).replace(/\s*\n\s*/g, ' ').trim();
}

export function excerpt(html: string, maxLength = 120): string {
  const text = displayLine(html);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}