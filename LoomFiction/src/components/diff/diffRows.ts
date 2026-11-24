export interface DiffRowData {
  left: string | null;
  right: string | null;
  type: 'equal' | 'removed' | 'added';
  leftLine: number | null;
  rightLine: number | null;
  hunkId: number | null;
}

export type Seg = { text: string; changed: boolean };
export type Cell = { text: string; line: number | null; segs?: Seg[] };
export type DRow = { key: string; hunkId: number | null; equal: boolean; left: Cell | null; right: Cell | null };

const MAX_TOKENS = 900;
const MIN_JACCARD = 0.3; 
const MIN_RATIO = 0.45; 
const WINDOW = 3;

const isSpace = (token: string) => /^\s+$/.test(token);

const wordSet = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / (a.size + b.size - shared);
}

function toSegs(tokens: string[], keep: boolean[]): Seg[] {
  const changed = tokens.map((_, index) => !keep[index]);
  for (let i = 1; i < tokens.length - 1; i++) {
    if (!changed[i] && isSpace(tokens[i]) && changed[i - 1] && changed[i + 1]) changed[i] = true;
  }
  const segs: Seg[] = [];
  tokens.forEach((text, index) => {
    const last = segs[segs.length - 1];
    if (last && last.changed === changed[index]) last.text += text;
    else segs.push({ text, changed: changed[index] });
  });
  return segs;
}

export function wordDiff(a: string, b: string): { left: Seg[]; right: Seg[]; ratio: number } | null {
  const A = a.match(/\s+|\S+/g) ?? [];
  const B = b.match(/\s+|\S+/g) ?? [];
  if (A.length > MAX_TOKENS || B.length > MAX_TOKENS) return null;

  const n = A.length;
  const m = B.length;
  const width = m + 1;
  const dp = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        A[i] === B[j] ? dp[(i + 1) * width + j + 1] + 1 : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }

  const keepA = new Array<boolean>(n).fill(false);
  const keepB = new Array<boolean>(m).fill(false);
  let matchedWords = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      keepA[i] = true;
      keepB[j] = true;
      if (!isSpace(A[i])) matchedWords++;
      i++;
      j++;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) i++;
    else j++;
  }

  const wordsA = A.filter((token) => !isSpace(token)).length;
  const wordsB = B.filter((token) => !isSpace(token)).length;
  return {
    left: toSegs(A, keepA),
    right: toSegs(B, keepB),
    ratio: matchedWords / Math.max(wordsA, wordsB, 1),
  };
}

type Src = DiffRowData;

export function buildRows(rows: DiffRowData[]): DRow[] {
  const out: DRow[] = [];
  const cellL = (row: Src): Cell => ({ text: row.left ?? '', line: row.leftLine });
  const cellR = (row: Src): Cell => ({ text: row.right ?? '', line: row.rightLine });
  const push = (hunkId: number | null, equal: boolean, left: Cell | null, right: Cell | null) =>
    out.push({ key: `d${out.length}`, hunkId, equal, left, right });

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.type === 'equal') {
      push(row.hunkId, true, cellL(row), cellR(row));
      i++;
      continue;
    }

    const hunkId = row.hunkId;
    const removed: Src[] = [];
    const added: Src[] = [];
    let j = i;
    while (j < rows.length && rows[j].type !== 'equal' && rows[j].hunkId === hunkId) {
      if (rows[j].type === 'removed') removed.push(rows[j]);
      else added.push(rows[j]);
      j++;
    }
    i = j;

    const flush = (rems: Src[], adds: Src[]) => {
      const count = Math.max(rems.length, adds.length);
      for (let k = 0; k < count; k++) {
        push(hunkId, false, rems[k] ? cellL(rems[k]) : null, adds[k] ? cellR(adds[k]) : null);
      }
    };

    const addSets: Array<Set<string> | undefined> = [];
    const addSet = (index: number) => (addSets[index] ??= wordSet(added[index].right ?? ''));

    let pointer = 0;
    let pendingRemoved: Src[] = [];
    for (const rem of removed) {
      const remText = rem.left ?? '';
      let bestIndex = -1;
      let bestRatio = MIN_RATIO - Number.EPSILON;
      let best: ReturnType<typeof wordDiff> = null;

      if (remText.trim()) {
        const remSet = wordSet(remText);
        for (let k = pointer; k < Math.min(added.length, pointer + WINDOW); k++) {
          const addText = added[k].right ?? '';
          if (!addText.trim() || jaccard(remSet, addSet(k)) < MIN_JACCARD) continue;
          const diff = wordDiff(remText, addText);
          if (diff && diff.ratio > bestRatio) {
            bestRatio = diff.ratio;
            bestIndex = k;
            best = diff;
          }
        }
      }

      if (best && bestIndex >= 0) {
        flush(pendingRemoved, added.slice(pointer, bestIndex));
        pendingRemoved = [];
        push(
          hunkId,
          false,
          { ...cellL(rem), segs: best.left },
          { ...cellR(added[bestIndex]), segs: best.right },
        );
        pointer = bestIndex + 1;
      } else {
        pendingRemoved.push(rem);
      }
    }
    flush(pendingRemoved, added.slice(pointer));
  }
  return out;
}

export function changeIdsOf(rows: DiffRowData[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (row.type === 'equal' || row.hunkId === null || seen.has(row.hunkId)) continue;
    seen.add(row.hunkId);
    ids.push(row.hunkId);
  }
  return ids;
}

const MAX_LCS_CELLS = 2_000_000;

export function diffLines(oldLines: string[], newLines: string[]): DiffRowData[] {
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
  let endOld = oldLines.length;
  let endNew = newLines.length;
  while (endOld > start && endNew > start && oldLines[endOld - 1] === newLines[endNew - 1]) {
    endOld--;
    endNew--;
  }

  const a = oldLines.slice(start, endOld);
  const b = newLines.slice(start, endNew);
  const events: Array<{ type: 'equal' | 'removed' | 'added'; oldIndex?: number; newIndex?: number }> = [];

  if (a.length * b.length > MAX_LCS_CELLS) {
    a.forEach((_, oldIndex) => events.push({ type: 'removed', oldIndex }));
    b.forEach((_, newIndex) => events.push({ type: 'added', newIndex }));
  } else {
    const width = b.length + 1;
    const dp = new Uint32Array((a.length + 1) * width);
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        dp[i * width + j] =
          a[i] === b[j] ? dp[(i + 1) * width + j + 1] + 1 : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) events.push({ type: 'equal', oldIndex: i++, newIndex: j++ });
      else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) events.push({ type: 'removed', oldIndex: i++ });
      else events.push({ type: 'added', newIndex: j++ });
    }
    while (i < a.length) events.push({ type: 'removed', oldIndex: i++ });
    while (j < b.length) events.push({ type: 'added', newIndex: j++ });
  }

  const rows: DiffRowData[] = [];
  let oldNumber = 1;
  let newNumber = 1;
  let hunk = -1;
  let inChange = false;

  const equal = (text: string) => {
    rows.push({ left: text, right: text, type: 'equal', leftLine: oldNumber++, rightLine: newNumber++, hunkId: null });
    inChange = false;
  };
  const change = (type: 'removed' | 'added', text: string) => {
    if (!inChange) {
      hunk++;
      inChange = true;
    }
    if (type === 'removed') rows.push({ left: text, right: null, type, leftLine: oldNumber++, rightLine: null, hunkId: hunk });
    else rows.push({ left: null, right: text, type, leftLine: null, rightLine: newNumber++, hunkId: hunk });
  };

  for (let k = 0; k < start; k++) equal(oldLines[k]);
  for (const event of events) {
    if (event.type === 'equal') equal(a[event.oldIndex!]);
    else if (event.type === 'removed') change('removed', a[event.oldIndex!]);
    else change('added', b[event.newIndex!]);
  }
  for (let k = endOld; k < oldLines.length; k++) equal(oldLines[k]);
  return rows;
}