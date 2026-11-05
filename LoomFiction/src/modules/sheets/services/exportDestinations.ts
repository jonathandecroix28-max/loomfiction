import JSZip from 'jszip';

export interface ExportFile {
  name: string;
  blob: Blob;
  folder?: string;
}

export function sanitizeName(raw: string, fallback = 'sans-titre'): string {
  const clean = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80)
    .trim();
  return clean || fallback;
}

export function withSuffix(name: string, n: number): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
}

export function uniqueName(name: string, taken: Set<string>): string {
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) candidate = withSuffix(name, n);
  taken.add(candidate.toLowerCase());
  return candidate;
}


export async function captureDownload(run: () => unknown): Promise<{ name: string; blob: Blob } | null> {
  const blobs = new Map<string, Blob>();
  const result: { file: { name: string; blob: Blob } | null } = { file: null };

  const originalCreate = URL.createObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;

  URL.createObjectURL = function (object: Blob | MediaSource) {
    const url = originalCreate.call(URL, object);
    if (object instanceof Blob) blobs.set(url, object);
    return url;
  };

  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    const blob = blobs.get(this.href);
    if (this.download && blob && !result.file) {
      result.file = { name: this.download, blob };
      return;
    }
    originalClick.call(this);
  };

  try {
    await run();
    await new Promise((resolve) => setTimeout(resolve, 0)); // laisse finir un éventuel traitement asynchrone
  } finally {
    URL.createObjectURL = originalCreate;
    HTMLAnchorElement.prototype.click = originalClick;
  }

  return result.file;
}


export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadZip(files: ExportFile[], rootName: string): Promise<void> {
  const zip = new JSZip();
  const root = zip.folder(rootName);
  if (!root) throw new Error('Impossible de créer le dossier compressé.');

  const taken = new Map<string, Set<string>>();
  for (const file of files) {
    const key = file.folder ?? '';
    const names = taken.get(key) ?? new Set<string>();
    taken.set(key, names);

    const target = file.folder ? root.folder(file.folder) : root;
    target?.file(uniqueName(file.name, names), file.blob);
  }

  const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(archive, `${rootName}.zip`);
}


interface WritableLike {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
}
export interface DirectoryHandleLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<DirectoryHandleLike>;
};

export const supportsDirectoryPicker = (): boolean =>
  typeof window !== 'undefined' && window.isSecureContext && typeof (window as PickerWindow).showDirectoryPicker === 'function';

export async function pickDirectory(): Promise<DirectoryHandleLike> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('Ce navigateur ne permet pas de choisir un dossier.');
  return picker.call(window, { id: 'loomfiction-export', mode: 'readwrite', startIn: 'documents' });
}

async function fileExists(dir: DirectoryHandleLike, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

export async function writeToDirectory(files: ExportFile[], root: DirectoryHandleLike, subfolder?: string): Promise<void> {
  const base = subfolder ? await root.getDirectoryHandle(subfolder, { create: true }) : root;
  const folders = new Map<string, DirectoryHandleLike>();

  for (const file of files) {
    let dir = base;
    if (file.folder) {
      dir = folders.get(file.folder) ?? (await base.getDirectoryHandle(file.folder, { create: true }));
      folders.set(file.folder, dir);
    }

    let name = file.name;
    for (let n = 2; (await fileExists(dir, name)) && n < 200; n += 1) name = withSuffix(file.name, n);

    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.blob);
    await writable.close();
  }
}

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';