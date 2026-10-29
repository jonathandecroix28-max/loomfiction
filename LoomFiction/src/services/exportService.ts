import DOMPurify from 'dompurify';
import { offlineBookService } from './offlineBookService';
import { offlineChapterService } from './offlineChapterService';

/* ───────────────────────── Types ───────────────────────── */

export type ExportFormat = 'docx' | 'pdf' | 'epub' | 'md' | 'html' | 'txt';

export type ExportChapter = { number: number; title: string; content: string };
export type ExportBook = { title: string; author?: string; chapters: ExportChapter[] };
export type ExportOptions = {
  titlePage: boolean;
  chapterNumbers: boolean;
  spacedParagraphs?: boolean;
};

const isSpaced = (options: ExportOptions): boolean => options.spacedParagraphs ?? true;
export type ExportProgress = (done: number, total: number) => void;
export type PreviewView = { fontScale?: number; dark?: boolean };

export const EXPORT_FORMATS: {
  key: ExportFormat;
  icon: string;
  label: string;
  hint: string;
  done: string;
}[] = [
  {
    key: 'docx',
    icon: '📝',
    label: 'Word (.docx)',
    hint: 'Word, Google Docs, Pages, LibreOffice, Scrivener',
    done: 'Fichier Word (.docx) téléchargé. Ouvre-le dans Word, Pages ou LibreOffice, ou importe-le dans Google Docs.',
  },
  {
    key: 'pdf',
    icon: '📄',
    label: 'PDF',
    hint: 'Mise en page livre, via « Enregistrer au format PDF »',
    done: 'La boîte d’impression est ouverte : choisis « Enregistrer au format PDF ».',
  },
  {
    key: 'epub',
    icon: '📖',
    label: 'EPUB',
    hint: 'Liseuses, Kindle (KDP), Kobo, Apple Books',
    done: 'Fichier EPUB téléchargé, prêt pour une liseuse ou une plateforme de publication.',
  },
  {
    key: 'md',
    icon: '🧾',
    label: 'Markdown',
    hint: 'Notion, Obsidian, blogs et plateformes d’écriture',
    done: 'Fichier Markdown téléchargé, utilisable dans Notion, Obsidian ou un blog.',
  },
  {
    key: 'html',
    icon: '🌐',
    label: 'Page web (HTML)',
    hint: 'Page autonome à publier ou à ouvrir dans un navigateur',
    done: 'Page HTML téléchargée : ouvre-la dans un navigateur ou publie-la sur un site.',
  },
  {
    key: 'txt',
    icon: '🔤',
    label: 'Texte brut',
    hint: 'Sans mise en forme, lisible partout',
    done: 'Fichier texte téléchargé.',
  },
];

/* ───────────────────────── Chargement des données ───────────────────────── */

export async function loadBookForExport(bookId: number, author?: string): Promise<ExportBook> {
  const book = await offlineBookService.getById(bookId);
  const chapters = await offlineChapterService.getByBookId(bookId);

  return {
    title: book.title || 'Sans titre',
    author,
    chapters: chapters.map((chapter) => ({
      number: Number(chapter.chapter_number),
      title: chapter.title || `Chapitre ${chapter.chapter_number}`,
      content: chapter.content ?? '',
    })),
  };
}

export async function loadBooksForExport(): Promise<{ id: number; title: string }[]> {
  const books = await offlineBookService.getAll();
  return books.map((book) => ({
    id: Number(book.id),
    title: book.title || `Roman #${book.id}`,
  }));
}

/* ───────────────────────── Utilitaires ───────────────────────── */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// eslint-disable-next-line no-control-regex
const XML_INVALID_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function escapeXml(text: string): string {
  return text
    .replace(XML_INVALID_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function looksLikeHtml(text: string): boolean {
  return /<[a-z][^>]*>/i.test(text);
}

function chapterLabel(chapter: ExportChapter, options: ExportOptions): string {
  return options.chapterNumbers ? `Chapitre ${chapter.number} — ${chapter.title}` : chapter.title;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ───────────────────────── Performances ───────────────────────── */


const CACHE_LIMIT = 300;
const htmlCache = new Map<string, string>();
const wordCache = new Map<string, number>();

function remember<T>(cache: Map<string, T>, key: string, compute: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}


function replaceBlankParagraphs(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll('p').forEach((paragraph) => {
    const text = (paragraph.textContent ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim();
    if (!text) {
      paragraph.innerHTML = '<br />';
    }
  });

  return container.innerHTML;
}

function normalizeContent(raw: string): string {
  return remember(htmlCache, raw || '', () => {
    const text = raw || '';
    if (looksLikeHtml(text)) {
      return replaceBlankParagraphs(DOMPurify.sanitize(text));
    }

    return text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
      .join('\n');
  });
}

export function countWords(content: string): number {
  return remember(wordCache, content || '', () => {
    const text = (content || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return text ? text.split(/\s+/).length : 0;
  });
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));


async function mapChunked<T, R>(
  items: T[],
  fn: (item: T, index: number) => R,
  onProgress?: ExportProgress,
  chunk = 3
): Promise<R[]> {
  const out: R[] = [];
  for (let index = 0; index < items.length; index += 1) {
    out.push(fn(items[index], index));
    if ((index + 1) % chunk === 0 || index === items.length - 1) {
      onProgress?.(index + 1, items.length);
      await tick();
    }
  }
  return out;
}

async function newZip() {
  const { default: JSZip } = await import('jszip');
  return new JSZip();
}

/* ───────────────────────── Conversion HTML → texte / Markdown ───────────────────────── */

function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n');
  const text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? '';
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
}

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'figure',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'table',
]);

const tagOf = (node: Node): string => (node.nodeType === 1 ? (node as Element).tagName.toLowerCase() : '');

function markdownWrap(text: string, mark: string): string {
  const core = text.trim();
  if (!core) return text;
  const lead = text.match(/^\s*/)?.[0] ?? '';
  const trail = text.match(/\s*$/)?.[0] ?? '';
  return `${lead}${mark}${core}${mark}${trail}`;
}

function markdownInline(node: Node): string {
  if (node.nodeType === 3) {
    return (node.textContent ?? '').replace(/\s+/g, ' ').replace(/([\\*_`])/g, '\\$1');
  }
  if (node.nodeType !== 1) return '';

  const element = node as HTMLElement;
  const inner = () => Array.from(element.childNodes).map(markdownInline).join('');

  switch (tagOf(node)) {
    case 'br':
      return '  \n';
    case 'strong':
    case 'b':
      return markdownWrap(inner(), '**');
    case 'em':
    case 'i':
      return markdownWrap(inner(), '*');
    case 's':
    case 'del':
    case 'strike':
      return markdownWrap(inner(), '~~');
    case 'u':
      return `<u>${inner()}</u>`;
    case 'a': {
      const href = element.getAttribute('href');
      const text = inner();
      return href ? `[${text}](${href})` : text;
    }
    case 'img':
      return '';
    default:
      return inner();
  }
}

function markdownList(list: Element, depth: number): string[] {
  const ordered = tagOf(list) === 'ol';
  const lines: string[] = [];
  let index = 0;

  list.childNodes.forEach((item) => {
    if (tagOf(item) !== 'li') return;
    index += 1;

    const own: Node[] = [];
    const nested: Element[] = [];
    item.childNodes.forEach((grand) => {
      const grandTag = tagOf(grand);
      if (grandTag === 'ul' || grandTag === 'ol') nested.push(grand as Element);
      else own.push(grand);
    });

    const text = own.map(markdownInline).join('').trim();
    if (text) lines.push(`${'  '.repeat(depth)}${ordered ? `${index}.` : '-'} ${text}`);
    nested.forEach((sub) => lines.push(...markdownList(sub, depth + 1)));
  });

  return lines;
}

function markdownBlocks(parent: Node, depth = 0): string[] {
  const blocks: string[] = [];
  let inline: Node[] = [];

  const flush = () => {
    const text = inline.map(markdownInline).join('').trim();
    if (text) blocks.push(text);
    inline = [];
  };

  parent.childNodes.forEach((child) => {
    const tag = tagOf(child);
    if (!BLOCK_TAGS.has(tag)) {
      inline.push(child);
      return;
    }
    flush();
    const element = child as HTMLElement;

    if (tag === 'p') {
      const text = Array.from(element.childNodes).map(markdownInline).join('').trim();
      if (text) blocks.push(text);
    } else if (/^h[1-6]$/.test(tag)) {
      // Le titre du chapitre est en "##" : les titres internes descendent d'un cran
      const level = Math.min(6, Number(tag[1]) + 2);
      const text = Array.from(element.childNodes).map(markdownInline).join('').trim();
      if (text) blocks.push(`${'#'.repeat(level)} ${text}`);
    } else if (tag === 'blockquote') {
      const quoted = markdownBlocks(element, depth).join('\n\n');
      if (quoted) blocks.push(quoted.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n'));
    } else if (tag === 'ul' || tag === 'ol') {
      const lines = markdownList(element, depth);
      if (lines.length) blocks.push(lines.join('\n'));
    } else if (tag === 'hr') {
      blocks.push('---');
    } else if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'figure') {
      blocks.push(...markdownBlocks(element, depth));
    } else {
      const text = (element.textContent ?? '').trim();
      if (text) blocks.push(text);
    }
  });

  flush();
  return blocks;
}

function htmlToMarkdown(html: string): string {
  return markdownBlocks(parseBody(html)).join('\n\n');
}

/* ───────────────────────── Mise en page commune (PDF, EPUB, HTML) ───────────────────────── */

const BOOK_CSS = `
body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #111; }
h1 { font-size: 28pt; text-align: center; margin: 0 0 0.4em; }
.title-page { text-align: center; padding-top: 30%; page-break-after: always; break-after: page; }
.author { font-size: 14pt; font-style: italic; margin: 0; }
.chapter { page-break-before: always; break-before: page; }
.chapter header { text-align: center; margin: 2em 0 1.5em; }
.kicker { text-transform: uppercase; letter-spacing: 0.2em; font-size: 9pt; color: #666; margin: 0 0 0.4em; }
h2 { font-size: 20pt; margin: 0; }
.chapter hr { border: 0; text-align: center; margin: 1.2em 0; }
.chapter hr::after { content: '* * *'; color: #666; }
blockquote { margin: 1em 2em; font-style: italic; }
`;

function paragraphCss(options: ExportOptions): string {
  const common = `
.chapter p:not(.kicker) { orphans: 3; widows: 3; text-align: justify; }
.chapter p.blank { margin: 0; text-indent: 0; }
.chapter li > p, .chapter blockquote p { margin: 0; text-indent: 0; }
.chapter h2 { break-after: avoid; page-break-after: avoid; }`;
  return isSpaced(options)
    ? `${common}\n.chapter p:not(.kicker):not(.blank) { margin: 0 0 0.8em; text-indent: 0; }`
    : `${common}\n.chapter p:not(.kicker):not(.blank) { margin: 0; text-indent: 1.4em; }\n.chapter header + p, .chapter hr + p, .chapter p.blank + p { text-indent: 0; }`;
}

const bookCss = (options: ExportOptions): string => `${BOOK_CSS}${paragraphCss(options)}\n`;

function titlePageHtml(book: ExportBook): string {
  return `<section class="title-page"><h1>${escapeHtml(book.title)}</h1>${
    book.author ? `<p class="author">${escapeHtml(book.author)}</p>` : ''
  }</section>`;
}

function chapterHtml(chapter: ExportChapter, options: ExportOptions, index = 0): string {
  const kicker = options.chapterNumbers ? `<p class="kicker">Chapitre ${chapter.number}</p>` : '';
  return `<section class="chapter" id="chapitre-${index + 1}"><header>${kicker}<h2>${escapeHtml(
    chapter.title
  )}</h2></header>${normalizeContent(chapter.content)}</section>`;
}

function bookBodyHtml(book: ExportBook, options: ExportOptions): string {
  return [
    options.titlePage ? titlePageHtml(book) : '',
    ...book.chapters.map((chapter, index) => chapterHtml(chapter, options, index)),
  ].join('\n');
}

/* ───────────────────────── PDF (impression du navigateur) ───────────────────────── */

function buildPrintableDocument(book: ExportBook, options: ExportOptions): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(
    book.title
  )}</title><style>@page { margin: 2.5cm; } ${bookCss(options)}</style></head><body>${bookBodyHtml(book, options)}</body></html>`;
}

function printHtml(html: string, title: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;pointer-events:none';
    document.body.appendChild(iframe);

    const previousTitle = document.title;
    const cleanup = () => {
      document.title = previousTitle;
      iframe.remove();
    };

    iframe.onload = async () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        resolve();
        return;
      }

      try {
        await win.document.fonts?.ready;
      } catch {
        /* polices indisponibles : on imprime quand même */
      }

      document.title = title;
      win.addEventListener('afterprint', cleanup, { once: true });
      win.focus();
      win.print();
      resolve();

      // Filet de sécurité : certains navigateurs mobiles n'émettent pas "afterprint"
      setTimeout(cleanup, 120_000);
    };

    iframe.srcdoc = html;
  });
}

/* ───────────────────────── HTML autonome ───────────────────────── */

function buildHtmlFile(book: ExportBook, options: ExportOptions): Blob {
  const toc =
    book.chapters.length > 1
      ? `<nav class="toc"><h2>Table des matières</h2><ol>${book.chapters
          .map(
            (chapter, index) =>
              `<li><a href="#chapitre-${index + 1}">${escapeHtml(chapterLabel(chapter, options))}</a></li>`
          )
          .join('')}</ol></nav>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(book.title)}</title>${book.author ? `\n<meta name="author" content="${escapeHtml(book.author)}">` : ''}
<style>${bookCss(options)}
body { max-width: 40rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; font-size: 1.1rem; }
.title-page { padding: 4rem 0; }
.chapter { page-break-before: auto; break-before: auto; margin-top: 4rem; }
.toc { margin: 2rem 0; }
.toc h2 { font-size: 1.3rem; }
.toc ol { padding-left: 1.2rem; line-height: 1.9; }
@media print { .toc { display: none; } .chapter { page-break-before: always; break-before: page; } }
</style>
</head>
<body>
${options.titlePage ? titlePageHtml(book) : ''}
${toc}
${book.chapters.map((chapter, index) => chapterHtml(chapter, options, index)).join('\n')}
</body>
</html>`;

  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

/* ───────────────────────── Markdown ───────────────────────── */

function buildMarkdown(book: ExportBook, options: ExportOptions): Blob {
  const parts: string[] = [];

  if (options.titlePage) {
    parts.push(`# ${book.title}`);
    if (book.author) parts.push(`*${book.author}*`);
    parts.push('---');
  }

  book.chapters.forEach((chapter) => {
    parts.push(`## ${chapterLabel(chapter, options)}`);
    const body = htmlToMarkdown(normalizeContent(chapter.content));
    if (body) parts.push(body);
  });

  return new Blob([`${parts.join('\n\n')}\n`], { type: 'text/markdown;charset=utf-8' });
}

/* ───────────────────────── Texte brut ───────────────────────── */

function buildTextString(book: ExportBook, options: ExportOptions): string {
  const parts: string[] = [];

  if (options.titlePage) {
    parts.push([book.title.toUpperCase(), book.author ?? ''].filter(Boolean).join('\n'));
  }

  book.chapters.forEach((chapter) => {
    const heading = chapterLabel(chapter, options);
    parts.push(
      `${heading}\n${'-'.repeat(Math.min(heading.length, 60))}\n\n${htmlToText(normalizeContent(chapter.content))}`
    );
  });

  return parts.join('\n\n\n');
}

/* ───────────────────────── Copier dans le presse-papiers ───────────────────────── */

export async function copyBookToClipboard(book: ExportBook, options: ExportOptions): Promise<'rich' | 'text'> {
  const html = [
    options.titlePage ? `<h1>${escapeHtml(book.title)}</h1>${book.author ? `<p><em>${escapeHtml(book.author)}</em></p>` : ''}` : '',
    ...book.chapters.map(
      (chapter) => `<h2>${escapeHtml(chapterLabel(chapter, options))}</h2>${normalizeContent(chapter.content)}`
    ),
  ].join('\n');
  const text = buildTextString(book, options);

  if (navigator.clipboard && typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard.write === 'function') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return 'rich';
  }

  await navigator.clipboard.writeText(text);
  return 'text';
}

/* ───────────────────────── EPUB ───────────────────────── */

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function toXhtml(html: string): string {
  const serializer = new XMLSerializer();
  return Array.from(parseBody(html).childNodes)
    .map((node) => serializer.serializeToString(node))
    .join('');
}

function xhtmlPage(title: string, bodyXhtml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${bodyXhtml}</body>
</html>`;
}

async function buildEpub(book: ExportBook, options: ExportOptions, onProgress?: ExportProgress): Promise<Blob> {
  const zip = await newZip();
  const bookId = `urn:uuid:${uuid()}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  );
  zip.file('OEBPS/style.css', bookCss(options));

  const pages: { id: string; href: string; title: string }[] = [];

  if (options.titlePage) {
    pages.push({ id: 'title', href: 'title.xhtml', title: 'Page de titre' });
    zip.file('OEBPS/title.xhtml', xhtmlPage(book.title, toXhtml(titlePageHtml(book))));
  }

  const chapterPages = await mapChunked(
    book.chapters,
    (chapter, index) => xhtmlPage(chapter.title, toXhtml(chapterHtml(chapter, options, index))),
    onProgress
  );

  book.chapters.forEach((chapter, index) => {
    const href = `chapter-${index + 1}.xhtml`;
    pages.push({ id: `chapter-${index + 1}`, href, title: chapterLabel(chapter, options) });
    zip.file(`OEBPS/${href}`, chapterPages[index]);
  });

  zip.file(
    'OEBPS/nav.xhtml',
    xhtmlPage(
      'Table des matières',
      `<nav epub:type="toc" id="toc"><h1>Table des matières</h1><ol>${pages
        .map((page) => `<li><a href="${page.href}">${escapeHtml(page.title)}</a></li>`)
        .join('')}</ol></nav>`
    )
  );

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${bookId}"/></head>
  <docTitle><text>${escapeHtml(book.title)}</text></docTitle>
  <navMap>${pages
    .map(
      (page, i) =>
        `<navPoint id="np-${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeHtml(
          page.title
        )}</text></navLabel><content src="${page.href}"/></navPoint>`
    )
    .join('')}</navMap>
</ncx>`
  );

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="fr">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${bookId}</dc:identifier>
    <dc:title>${escapeHtml(book.title)}</dc:title>
    <dc:language>fr</dc:language>${book.author ? `\n    <dc:creator>${escapeHtml(book.author)}</dc:creator>` : ''}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${pages.map((page) => `<item id="${page.id}" href="${page.href}" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${pages.map((page) => `<itemref idref="${page.id}"/>`).join('\n    ')}
  </spine>
</package>`
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/* ───────────────────────── Word (.docx) — vrai format OOXML ───────────────────────── */

type RunFmt = { b?: boolean; i?: boolean; u?: boolean; s?: boolean };
type Seg = { text: string; fmt: RunFmt } | { br: true };
type DocxCtx = { first: boolean };

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const DOCX_ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const DOCX_DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="${REL}/footer" Target="footer1.xml"/>
</Relationships>`;

const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="567"/><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="FirstPara"><w:name w:val="First Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/><w:pPr><w:spacing w:before="3600" w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="64"/><w:szCs w:val="64"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Kicker"><w:name w:val="Chapter Number"/><w:basedOn w:val="Normal"/><w:next w:val="Heading1"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="1200" w:after="60"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:caps/><w:color w:val="666666"/><w:spacing w:val="40"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="FirstPara"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="600" w:after="480"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="FirstPara"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720" w:right="720" w:firstLine="0"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="ListPara"><w:name w:val="List Item"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720" w:hanging="360"/><w:jc w:val="left"/></w:pPr></w:style>
</w:styles>`;

const docxStyles = (options: ExportOptions): string =>
  isSpaced(options)
    ? DOCX_STYLES.replace(
        '<w:name w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="567"/><w:jc w:val="both"/></w:pPr>',
        '<w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160"/><w:ind w:firstLine="0"/><w:jc w:val="both"/></w:pPr>'
      )
    : DOCX_STYLES;

const DOCX_FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:p><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;

const DOCX_SECTION = `<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

function runXml(text: string, fmt: RunFmt): string {
  const props = [fmt.b && '<w:b/>', fmt.i && '<w:i/>', fmt.s && '<w:strike/>', fmt.u && '<w:u w:val="single"/>']
    .filter(Boolean)
    .join('');
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function collectSegments(node: Node, fmt: RunFmt, out: Seg[]): void {
  if (node.nodeType === 3) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ');
    if (text) out.push({ text, fmt });
    return;
  }
  if (node.nodeType !== 1) return;

  const element = node as HTMLElement;
  const tag = tagOf(node);
  if (tag === 'br') {
    out.push({ br: true });
    return;
  }

  const next: RunFmt = { ...fmt };
  if (tag === 'strong' || tag === 'b') next.b = true;
  if (tag === 'em' || tag === 'i') next.i = true;
  if (tag === 'u') next.u = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') next.s = true;

  const style = element.style;
  if (style) {
    if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) next.b = true;
    if (style.fontStyle === 'italic') next.i = true;
    if (style.textDecoration?.includes('underline')) next.u = true;
  }

  element.childNodes.forEach((child) => collectSegments(child, next, out));
}

function hasContent(segs: Seg[]): boolean {
  return segs.some((seg) => 'br' in seg || seg.text.trim() !== '');
}

function segmentsToRuns(segs: Seg[]): string {
  const items = segs.map((seg) => ({ ...seg })) as Seg[];

  const firstText = items.find((seg) => 'text' in seg) as { text: string } | undefined;
  if (firstText) firstText.text = firstText.text.replace(/^\s+/, '');
  const lastText = [...items].reverse().find((seg) => 'text' in seg) as { text: string } | undefined;
  if (lastText) lastText.text = lastText.text.replace(/\s+$/, '');

  return items
    .map((seg) => {
      if ('br' in seg) return '<w:r><w:br/></w:r>';
      return seg.text ? runXml(seg.text, seg.fmt) : '';
    })
    .join('');
}

function paragraphXml(style: string, runs: string, extra = ''): string {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${runs}</w:p>`;
}

function alignmentOf(element: HTMLElement): string {
  switch (element.style?.textAlign) {
    case 'center':
      return '<w:jc w:val="center"/>';
    case 'right':
      return '<w:jc w:val="right"/>';
    case 'left':
      return '<w:jc w:val="left"/>';
    case 'justify':
      return '<w:jc w:val="both"/>';
    default:
      return '';
  }
}

function bodyParagraph(segs: Seg[], ctx: DocxCtx, quote: boolean, extra = ''): string {
  if (!hasContent(segs)) return '';
  const style = quote ? 'Quote' : ctx.first ? 'FirstPara' : 'Normal';
  ctx.first = false;
  return paragraphXml(style, segmentsToRuns(segs), extra);
}

function listToDocx(list: Element, out: string[], depth: number): void {
  const ordered = tagOf(list) === 'ol';
  let index = 0;

  list.childNodes.forEach((child) => {
    if (tagOf(child) !== 'li') return;
    index += 1;

    const segs: Seg[] = [];
    const nested: Element[] = [];
    child.childNodes.forEach((grand) => {
      const grandTag = tagOf(grand);
      if (grandTag === 'ul' || grandTag === 'ol') nested.push(grand as Element);
      else collectSegments(grand, {}, segs);
    });

    if (hasContent(segs)) {
      const marker = ordered ? `${index}. ` : '• ';
      out.push(
        paragraphXml(
          'ListPara',
          runXml(marker, {}) + segmentsToRuns(segs),
          `<w:ind w:left="${720 + depth * 360}" w:hanging="360"/>`
        )
      );
    }
    nested.forEach((sub) => listToDocx(sub, out, depth + 1));
  });
}

function walkBlocks(parent: Node, ctx: DocxCtx, out: string[], quote = false): void {
  let inline: Seg[] = [];

  const flush = () => {
    const paragraph = bodyParagraph(inline, ctx, quote);
    if (paragraph) out.push(paragraph);
    inline = [];
  };

  parent.childNodes.forEach((child) => {
    const tag = tagOf(child);
    if (!BLOCK_TAGS.has(tag)) {
      collectSegments(child, {}, inline);
      return;
    }

    flush();
    const element = child as HTMLElement;

    if (tag === 'p') {
      const segs: Seg[] = [];
      element.childNodes.forEach((grand) => collectSegments(grand, {}, segs));
      const paragraph = bodyParagraph(segs, ctx, quote, alignmentOf(element));
      if (paragraph) out.push(paragraph);
    } else if (/^h[1-6]$/.test(tag)) {
      const segs: Seg[] = [];
      element.childNodes.forEach((grand) => collectSegments(grand, { b: true }, segs));
      if (hasContent(segs)) out.push(paragraphXml('Heading2', segmentsToRuns(segs)));
      ctx.first = true;
    } else if (tag === 'blockquote') {
      walkBlocks(element, ctx, out, true);
      ctx.first = false;
    } else if (tag === 'ul' || tag === 'ol') {
      listToDocx(element, out, 0);
      ctx.first = false;
    } else if (tag === 'hr') {
      out.push(paragraphXml('Normal', runXml('* * *', {}), '<w:ind w:firstLine="0"/><w:jc w:val="center"/>'));
      ctx.first = true;
    } else if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'figure') {
      walkBlocks(element, ctx, out, quote);
    } else {
      const segs: Seg[] = [];
      collectSegments(element, {}, segs);
      const paragraph = bodyParagraph(segs, ctx, quote);
      if (paragraph) out.push(paragraph);
    }
  });

  flush();
}

function docxTitlePage(book: ExportBook): string {
  return [
    paragraphXml('Title', runXml(book.title, {})),
    book.author ? paragraphXml('Subtitle', runXml(book.author, {})) : '',
  ].join('');
}

function docxChapter(chapter: ExportChapter, options: ExportOptions): string {
  const out: string[] = [];
  const kicker = options.chapterNumbers;

  if (kicker) out.push(paragraphXml('Kicker', runXml(`Chapitre ${chapter.number}`, {}), '<w:pageBreakBefore/>'));
  out.push(paragraphXml('Heading1', runXml(chapter.title, {}), kicker ? '' : '<w:pageBreakBefore/>'));

  walkBlocks(parseBody(normalizeContent(chapter.content)), { first: true }, out);
  return out.join('');
}

async function buildDocx(book: ExportBook, options: ExportOptions, onProgress?: ExportProgress): Promise<Blob> {
  const zip = await newZip();
  const created = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  const chapters = await mapChunked(book.chapters, (chapter) => docxChapter(chapter, options), onProgress);
  const body = [options.titlePage ? docxTitlePage(book) : '', ...chapters].join('');

  zip.file('[Content_Types].xml', DOCX_CONTENT_TYPES);
  zip.file('_rels/.rels', DOCX_ROOT_RELS);
  zip.file('word/_rels/document.xml.rels', DOCX_DOC_RELS);
  zip.file('word/styles.xml', docxStyles(options));
  zip.file('word/footer1.xml', DOCX_FOOTER);
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>${body}${DOCX_SECTION}</w:body></w:document>`
  );
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(
      book.title
    )}</dc:title>${book.author ? `<dc:creator>${escapeXml(book.author)}</dc:creator>` : ''}<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>`
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/* ───────────────────────── Aperçu à l'écran ───────────────────────── */

export function buildPreviewDocument(book: ExportBook, options: ExportOptions, view: PreviewView = {}): string {
  const scale = view.fontScale ?? 1;
  const dark = view.dark ?? false;
  const palette = dark
    ? '--bg:#120d0a;--paper:#241a15;--ink:#f1e6d3;--muted:#a8987f;--rule:#4a3a2e;--shadow:0 2px 12px rgba(0,0,0,.6)'
    : '--bg:#e7e0d2;--paper:#fff;--ink:#1b1b1b;--muted:#666;--rule:#ccc;--shadow:0 2px 12px rgba(0,0,0,.25)';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${bookCss(options)}
:root { ${palette}; }
html { background: var(--bg); -webkit-text-size-adjust: 100%; }
body { font-size: ${(16 * scale).toFixed(1)}px; line-height: 1.7; color: var(--ink); background: var(--paper); max-width: 42rem; margin: 1rem auto; padding: 2.5rem 2rem; box-shadow: var(--shadow); hyphens: auto; -webkit-hyphens: auto; overflow-wrap: break-word; }
h1 { font-size: 2em; color: var(--ink); }
h2 { font-size: 1.5em; color: var(--ink); }
.author { font-size: 1.1em; }
.kicker, .chapter hr::after { color: var(--muted); }
.kicker { font-size: .75em; }
.title-page { padding: 3rem 0; page-break-after: auto; break-after: auto; }
.chapter { page-break-before: auto; break-before: auto; border-top: 1px dashed var(--rule); margin-top: 2.5rem; padding-top: 1rem; }
.title-page + .chapter, body > .chapter:first-child { border-top: 0; margin-top: 0; }
@media (max-width: 640px) {
  html { background: var(--paper); }
  body { margin: 0; padding: 1.5rem 1.15rem 4rem; max-width: none; box-shadow: none; }
  .chapter p { text-align: left; }
}
</style></head><body>${bookBodyHtml(book, options)}</body></html>`;
}

/* ───────────────────────── Point d'entrée ───────────────────────── */

export async function exportBook(
  book: ExportBook,
  format: ExportFormat,
  options: ExportOptions,
  onProgress?: ExportProgress
): Promise<void> {
  const baseName = slugify(book.title) || 'roman';

  switch (format) {
    case 'pdf':
      await printHtml(buildPrintableDocument(book, options), book.title);
      return;
    case 'docx':
      downloadBlob(await buildDocx(book, options, onProgress), `${baseName}.docx`);
      return;
    case 'epub':
      downloadBlob(await buildEpub(book, options, onProgress), `${baseName}.epub`);
      return;
    case 'md':
      downloadBlob(buildMarkdown(book, options), `${baseName}.md`);
      return;
    case 'html':
      downloadBlob(buildHtmlFile(book, options), `${baseName}.html`);
      return;
    case 'txt':
      downloadBlob(new Blob([buildTextString(book, options)], { type: 'text/plain;charset=utf-8' }), `${baseName}.txt`);
      return;
  }
}

//P.S: à optimiser