import type { EditorView } from '@tiptap/pm/view';
import { CHAPTER_IMAGE, compressImage } from './imageProcessing';

export const imageFilesFrom = (list: FileList | File[] | null | undefined): File[] =>
  Array.from(list ?? []).filter((file) => file.type.startsWith('image/'));

const altFrom = (fileName: string): string => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

export async function insertImageFiles(view: EditorView, files: File[], pos?: number): Promise<string | null> {
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return 'L’éditeur ne gère pas les images.';

  let error: string | null = null;
  let at = pos ?? view.state.selection.to;

  for (const file of files) {
    try {
      const src = await compressImage(file, CHAPTER_IMAGE);
      const node = imageType.create({ src, alt: altFrom(file.name) });
      const target = Math.min(at, view.state.doc.content.size);
      const tr = view.state.tr.replaceRangeWith(target, target, node);
      at = tr.mapping.map(target, 1);
      view.dispatch(tr.scrollIntoView());
    } catch (e) {
      error = e instanceof Error ? e.message : 'Impossible d’insérer cette image.';
    }
  }

  return error;
}