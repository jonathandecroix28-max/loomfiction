export type LineDiffKind = 'equal' | 'change' | 'current' | 'version';
export type LineChoice = 'current' | 'version';
export type LineChoices = Record<string, LineChoice>;

export type LineDiffRow = {
  id: string;
  kind: LineDiffKind;
  currentIndex: number | null;
  versionIndex: number | null;
  currentLine: string;
  versionLine: string;
};

const BLOCK_END = /(<\/(?:p|h[1-6]|li|blockquote|pre)>|<hr\s*\/?>)/gi;


export function splitLines(text: string): string[] {
  const isHtml = /<[a-z][^>]*>/i.test(text);
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = (isHtml ? normalized.replace(BLOCK_END, '$1\n') : normalized).split('\n');
  const result = isHtml ? lines.map((line) => line.trim()).filter((line) => line !== '') : lines;
  return result.length === 1 && result[0] === '' ? [] : result;
}

/* -------------------------------------------------------------------------- */
/*  Calcul du diff                                                             */
/* -------------------------------------------------------------------------- */

const same = (a: string, b: string) => a.trimEnd() === b.trimEnd();

const MAX_LCS_CELLS = 4_000_000;

const equalRow = (a: string[], b: string[], i: number, j: number): LineDiffRow => ({
  id: `eq-${i}-${j}`,
  kind: 'equal',
  currentIndex: i,
  versionIndex: j,
  currentLine: a[i],
  versionLine: b[j],
});


function diffMiddle(a: string[], b: string[], start: number, endA: number, endB: number): LineDiffRow[] {
  const rows: LineDiffRow[] = [];
  const n = endA - start;
  const m = endB - start;

  let removed: number[] = []; 
  let added: number[] = []; 

  const flush = () => {
    const pairs = Math.min(removed.length, added.length);

    for (let k = 0; k < pairs; k += 1) {
      const ci = removed[k];
      const vi = added[k];
      rows.push({
        id: `chg-${ci}-${vi}`,
        kind: 'change',
        currentIndex: ci,
        versionIndex: vi,
        currentLine: a[ci],
        versionLine: b[vi],
      });
    }
    for (let k = pairs; k < removed.length; k += 1) {
      const ci = removed[k];
      rows.push({
        id: `cur-${ci}`,
        kind: 'current',
        currentIndex: ci,
        versionIndex: null,
        currentLine: a[ci],
        versionLine: '',
      });
    }
    for (let k = pairs; k < added.length; k += 1) {
      const vi = added[k];
      rows.push({
        id: `ver-${vi}`,
        kind: 'version',
        currentIndex: null,
        versionIndex: vi,
        currentLine: '',
        versionLine: b[vi],
      });
    }

    removed = [];
    added = [];
  };

  if (n === 0 && m === 0) return rows;

  if ((n + 1) * (m + 1) > MAX_LCS_CELLS) {
    for (let i = 0; i < n; i += 1) removed.push(start + i);
    for (let j = 0; j < m; j += 1) added.push(start + j);
    flush();
    return rows;
  }

  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * w + j] = same(a[start + i], b[start + j])
        ? dp[(i + 1) * w + j + 1] + 1
        : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(a[start + i], b[start + j])) {
      flush();
      rows.push(equalRow(a, b, start + i, start + j));
      i += 1;
      j += 1;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      removed.push(start + i);
      i += 1;
    } else {
      added.push(start + j);
      j += 1;
    }
  }

  while (i < n) {
    removed.push(start + i);
    i += 1;
  }
  while (j < m) {
    added.push(start + j);
    j += 1;
  }
  flush();

  return rows;
}

/**
 * Diff complet. Les lignes identiques au début et à la fin sont retirées avant le calcul
 * (cas le plus courant : une version ne diffère que par quelques paragraphes), ce qui
 * réduit énormément le coût sur un long chapitre.
 */
export function buildLineDiff(currentText: string, versionText: string): LineDiffRow[] {
  const a = splitLines(currentText);
  const b = splitLines(versionText);

  let start = 0;
  while (start < a.length && start < b.length && same(a[start], b[start])) start += 1;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && same(a[endA - 1], b[endB - 1])) {
    endA -= 1;
    endB -= 1;
  }

  const rows: LineDiffRow[] = [];
  for (let k = 0; k < start; k += 1) rows.push(equalRow(a, b, k, k));
  rows.push(...diffMiddle(a, b, start, endA, endB));
  for (let k = 0; endA + k < a.length; k += 1) rows.push(equalRow(a, b, endA + k, endB + k));

  return rows;
}

/* -------------------------------------------------------------------------- */
/*  Choix ligne par ligne et fusion                                            */
/* -------------------------------------------------------------------------- */

export function defaultChoice(row: LineDiffRow): LineChoice {
  return row.kind === 'version' ? 'version' : 'current';
}

export function defaultLineChoices(rows: LineDiffRow[]): LineChoices {
  return rows.reduce<LineChoices>((acc, row) => {
    acc[row.id] = defaultChoice(row);
    return acc;
  }, {});
}

export function composeLineMerge(rows: LineDiffRow[], choices: LineChoices): string {
  return rows
    .flatMap((row) => {
      if (row.kind === 'equal') return [row.currentLine];
      const choice = choices[row.id] ?? defaultChoice(row);
      if (choice === 'version') return row.kind === 'current' ? [] : [row.versionLine];
      return row.kind === 'version' ? [] : [row.currentLine];
    })
    .join('\n');
}

export function mergeWithDefaults(currentText: string, versionText: string): string {
  const rows = buildLineDiff(currentText, versionText);
  return composeLineMerge(rows, defaultLineChoices(rows));
}

/* -------------------------------------------------------------------------- */
/*  Libellés et styles d'affichage                                             */
/* -------------------------------------------------------------------------- */

export function choiceLabels(kind: LineDiffKind): { current: string; version: string } {
  if (kind === 'current') return { current: 'Garder', version: 'Retirer' };
  if (kind === 'version') return { current: 'Ignorer', version: 'Ajouter' };
  return { current: 'Garder actuel', version: 'Garder version' };
}

export function choiceSummary(kind: LineDiffKind, choice: LineChoice): string {
  if (kind === 'current') return choice === 'current' ? 'ligne conservée' : 'ligne retirée';
  if (kind === 'version') return choice === 'version' ? 'ligne ajoutée' : 'ligne ignorée';
  return choice === 'version' ? 'version' : 'actuel';
}

export function lineNumberOf(row: LineDiffRow): string {
  const c = row.currentIndex != null ? row.currentIndex + 1 : null;
  const v = row.versionIndex != null ? row.versionIndex + 1 : null;
  if (c != null && v != null && c !== v) return `${c} / ${v}`;
  return String(c ?? v ?? '-');
}

export function isSideMissing(row: LineDiffRow, side: LineChoice): boolean {
  return side === 'current' ? row.kind === 'version' : row.kind === 'current';
}

// Fond rouge = ce qui disparaît / change côté actuel, vert = ce qui apparaît côté version
export function sideBg(row: LineDiffRow, side: LineChoice): string {
  if (row.kind === 'equal' || isSideMissing(row, side)) return '';
  return side === 'current' ? 'bg-red-950/25' : 'bg-emerald-950/25';
}