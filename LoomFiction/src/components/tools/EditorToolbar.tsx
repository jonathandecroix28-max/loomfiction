import { useState, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { imageFilesFrom, insertImageFiles } from '../../utils/images/editorImages';
import {
  IconAlignCenter,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconCode,
  IconHeading1,
  IconHeading2,
  IconHeading3,
  IconImage,
  IconItalic,
  IconList,
  IconListOrdered,
  IconMinus,
  IconParagraph,
  IconQuote,
  IconRedo,
  IconStrike,
  IconUndo,
} from '../icons';

interface EditorToolbarProps {
  editor: Editor | null;
  onImageError?: (message: string | null) => void;
}

export function EditorToolbar({ editor, onImageError }: EditorToolbarProps) {
  const [, setForceUpdate] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    if (!editor) return;

    const handleTransaction = () => {
      setForceUpdate(prev => prev + 1);
    };

    editor.on('transaction', handleTransaction);

    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  const chain = () => editor.chain().focus();

  const handleImageFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = imageFilesFrom(event.target.files);
    event.target.value = '';
    if (files.length === 0) return;

    setImageBusy(true);
    const error = await insertImageFiles(editor.view, files);
    setImageBusy(false);
    onImageError?.(error);
  };

  const baseBtn =
    'px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer flex items-center justify-center min-w-[28px] sm:min-w-[32px] h-8 shrink-0 bg-neutral-900 hover:bg-neutral-800 text-amber-200/80 hover:text-amber-100 border border-amber-900/30';

  const activeBtn =
    'px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer flex items-center justify-center min-w-[28px] sm:min-w-[32px] h-8 shrink-0 bg-amber-700 text-amber-50 border border-amber-600 shadow-xs font-bold';

  const btnClass = (isActive: boolean) => (isActive ? activeBtn : baseBtn);

  const plainBtn = `${baseBtn} disabled:opacity-30 disabled:cursor-not-allowed`;

  const separator = <div className="h-4 w-[1px] bg-amber-900/40 mx-0.5 shrink-0" />;

  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap p-1.5 rounded-xl bg-neutral-950/80 border border-amber-900/40 text-amber-200 w-full no-scrollbar shrink-0 shadow-md">

      {/* Historique */}
      <button
        type="button"
        onClick={() => chain().undo().run()}
        disabled={!editor.can().undo()}
        className={plainBtn}
        title="Annuler (Ctrl+Z)"
      >
        <IconUndo className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => chain().redo().run()}
        disabled={!editor.can().redo()}
        className={plainBtn}
        title="Rétablir (Ctrl+Y)"
      >
        <IconRedo className="size-4" aria-hidden="true" />
      </button>

      {separator}

      {/* Style de texte */}
      <button type="button" onClick={() => chain().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="Gras">
        <IconBold className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="Italique">
        <IconItalic className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title="Barré">
        <IconStrike className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().toggleCode().run()} className={btnClass(editor.isActive('code'))} title="Code">
        <IconCode className="size-4" aria-hidden="true" />
      </button>

      {separator}

      {/* Alignements */}
      <button type="button" onClick={() => chain().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="Aligner à gauche">
        <IconAlignLeft className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="Centrer">
        <IconAlignCenter className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="Aligner à droite">
        <IconAlignRight className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().setTextAlign('justify').run()} className={btnClass(editor.isActive({ textAlign: 'justify' }))} title="Justifier">
        <IconAlignJustify className="size-4" aria-hidden="true" />
      </button>

      {separator}

      {/* Titres */}
      <button type="button" onClick={() => chain().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive('heading', { level: 1 }))} title="Titre 1">
        <IconHeading1 className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="Titre 2">
        <IconHeading2 className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive('heading', { level: 3 }))} title="Titre 3">
        <IconHeading3 className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().setParagraph().run()} className={btnClass(editor.isActive('paragraph'))} title="Paragraphe">
        <IconParagraph className="size-4" aria-hidden="true" />
      </button>

      {separator}

      {/* Listes & Citations */}
      <button type="button" onClick={() => chain().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Liste à puces">
        <IconList className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Liste numérotée">
        <IconListOrdered className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="Citation">
        <IconQuote className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => chain().setHorizontalRule().run()} className={baseBtn} title="Séparateur">
        <IconMinus className="size-4" aria-hidden="true" />
      </button>

      {separator}

      {/* Image */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={imageBusy}
        className={plainBtn}
        title="Insérer une image"
      >
        {imageBusy ? '…' : <IconImage className="size-4" aria-hidden="true" />}
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageFiles} />

    </div>
  );
}