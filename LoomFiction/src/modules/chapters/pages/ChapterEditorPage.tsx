import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { ChapterContent, ChapterHeading, READING_COLUMN, READING_TEXT } from '../components/ChapterReading';
import { useKeyboardViewport } from '../../../hooks/useKeyboardViewport';
import { offlineChapterService } from '../../../services/offlineChapterService';
import { offlineChapterVersionService } from '../../../services/offlineChapterVersionService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { useUpdateChapter } from '../../chapters/hooks/UseUpdateChapter';
import { useChapterVersions } from '../hooks/useChapterVersions';
import { EditorToolbar } from '../../../components/tools/EditorToolbar';
import { imageFilesFrom, insertImageFiles } from '../../../utils/images/editorImages';
import { createSheetMentionExtension } from '../../editor/extensions/SheetMention';
import { setupMentionPopovers } from '../../editor/utils/setupMentionPopovers';
import { MentionDetection } from '../../editor/components/MentionDetection';
import type { ChapterResponse } from '../../../types/chapter';
import type { ChapterVersionResponse } from '../../../types/chapterVersion';
import type { SheetResponse } from '../../../types/sheet';
import {
  IconAdd,
  IconBack,
  IconEdit,
  IconHistory,
  IconSave,
  IconSheet,
  IconView,
} from '../../../components/icons';

const keepEditorFocus = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('input, textarea, select')) return;
  event.preventDefault();
};

export function ChapterEditorPage() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const chapterIdNumber = chapterId ? Number(chapterId) : null;

  const [chapter, setChapter] = useState<ChapterResponse | null>(null);
  const [sheets, setSheets] = useState<SheetResponse[]>([]);
  const [title, setTitle] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [worldbuildingEnabled, setWorldbuildingEnabled] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showMentionDetection, setShowMentionDetection] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const sheetsRef = useRef<SheetResponse[]>([]);
  sheetsRef.current = sheets;

  const { updateChapter, isUpdating, error: updateError } = useUpdateChapter();
  const { versions: chapterVersions, refetch: refetchChapterVersions } = useChapterVersions(chapterIdNumber);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      createSheetMentionExtension(() => sheetsRef.current),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: `${READING_TEXT} focus:outline-none min-h-[60vh] pb-12`,
      },
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData?.files);
        if (files.length === 0 || event.clipboardData?.getData('text/plain')) return false;
        event.preventDefault();
        void insertImageFiles(view, files).then(setImageError);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = imageFilesFrom(event.dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImageFiles(view, files, pos).then(setImageError);
        return true;
      },
    },
  });

  // Le conteneur (rootRef) n'existe qu'une fois le chapitre chargé : l'effet doit se relancer à ce moment-là.
  // Avant, il ne dépendait pas de l'état de chargement et ne s'installait jamais si l'éditeur était prêt
  // avant la fin du chargement : les aperçus n'apparaissaient qu'après avoir quitté puis rouvert la page.
  const rootReady = !isPageLoading && !!chapter;

  useEffect(() => {
    if (!rootReady || !rootRef.current) return;
    const mentionPopovers = setupMentionPopovers(rootRef.current, (path) => navigate(path), editor);
    return () => mentionPopovers.destroy();
  }, [editor, isPreview, rootReady, navigate]);

  const keyboardOpen = useKeyboardViewport(rootRef, rootReady);

  useEffect(() => {
    if (!keyboardOpen || !editor) return;
    const timer = setTimeout(() => editor.commands.scrollIntoView(), 150);
    return () => clearTimeout(timer);
  }, [keyboardOpen, editor]);

  const previewHtml = useMemo(() => (isPreview && editor ? editor.getHTML() : ''), [isPreview, editor]);

  useEffect(() => {
    if (!imageError) return;
    const timer = setTimeout(() => setImageError(null), 6000);
    return () => clearTimeout(timer);
  }, [imageError]);

  useEffect(() => {
    const loadData = async () => {
      if (!chapterId) return;
      try {
        setIsPageLoading(true);
        const [chapterData, loadedSheets] = await Promise.all([
          offlineChapterService.getById(Number(chapterId)),
          offlineSheetService.getAll(),
        ]);

        if (!chapterData) {
          navigate('/404', { replace: true });
          return;
        }

        setChapter(chapterData);
        setTitle(chapterData.title);
        setSheets(loadedSheets);
      } catch (error) {
        console.error('Erreur lors du chargement des données :', error);
        navigate('/404', { replace: true });
      } finally {
        setIsPageLoading(false);
      }
    };

    void loadData();
  }, [chapterId, navigate]);

  useEffect(() => {
    if (editor && chapter && chapter.content) {
      if (editor.getText() === '') {
        editor.commands.setContent(chapter.content);
      }
    }
  }, [editor, chapter]);

  const handleSave = async () => {
    if (!chapterId || !chapter || !editor) return;

    setSaveMessage('');
    const htmlContent = editor.getHTML();

    const updated = await updateChapter(Number(chapterId), title, htmlContent);

    if (updated) {
      setChapter(updated);
      setSaveMessage('Enregistré');
      setTimeout(() => setSaveMessage(''), 3000);
    } else if (updateError) {
      setSaveMessage('Erreur sauvegarde.');
    }
  };

  const handleCreateVersion = async () => {
    if (!chapterId || !chapter || !editor) return;

    const nextVersionNumber =
      chapterVersions.length > 0
        ? Math.max(...chapterVersions.map((version: ChapterVersionResponse) => Number(version.versionNumber))) + 1
        : 1;

    try {
      await offlineChapterVersionService.create({
        chapterId: Number(chapterId),
        versionNumber: nextVersionNumber,
        name: title.trim() || chapter.title,
        content: editor.getHTML(),
      });
      await refetchChapterVersions();
      setSaveMessage(`v${nextVersionNumber} créée.`);
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la création de version :', error);
      setSaveMessage('Erreur version.');
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#1c1411] font-serif text-amber-200/60">
        Ouverture de l'écritoire...
      </div>
    );
  }

  if (!chapter) return null;

  const chapterNum = chapter?.chapter_number ?? 1;

  return (
    <div ref={rootRef} className="flex h-[100dvh] flex-col overflow-hidden bg-[#1c1411] font-serif text-[#fcf9f2]">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-amber-900/40 bg-[#1c1411]/95 px-3 py-2.5 shadow-md backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate(-1)}
            title="Retour"
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-sans text-amber-200/70 transition-colors hover:bg-neutral-900 hover:text-amber-100 sm:px-2.5 sm:text-sm"
          >
            <IconBack className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Retour</span>
          </button>

          <span className="text-xs text-amber-900/50">|</span>

          <span className="whitespace-nowrap font-sans text-xs font-medium text-amber-200/80 sm:text-sm">
            Ch. {chapterNum}
          </span>

          <button
            onClick={() => navigate(`/books/${bookId}/chapters/${chapterId}/versions`)}
            title="Historique des versions"
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-900/30 bg-neutral-900 px-2 text-xs font-medium text-amber-200 transition-colors hover:bg-neutral-800 sm:px-3"
          >
            <IconHistory className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Versions</span>
          </button>
        </div>

        {saveMessage && (
          <span className="max-w-[120px] animate-pulse truncate font-sans text-[11px] font-medium text-emerald-400 sm:max-w-none">
            {saveMessage}
          </span>
        )}
      </header>

      <main className={`flex-1 overflow-y-auto w-full flex flex-col ${isPreview ? '' : 'px-4 sm:px-6 pt-6'}`}>
        {isPreview ? (
          <div className={READING_COLUMN}>
            <ChapterHeading>{title}</ChapterHeading>
            <ChapterContent html={previewHtml} />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du chapitre..."
              className="mb-4 shrink-0 border-b border-amber-900/30 bg-transparent pb-3 font-serif text-2xl font-bold text-amber-100 placeholder:text-amber-200/30 focus:border-amber-600 focus:outline-none sm:text-3xl md:text-4xl"
            />

            {imageError && (
              <p role="alert" className="mb-3 shrink-0 font-sans text-sm text-red-400">
                {imageError}
              </p>
            )}
            <div className={`mt-2 flex-1 w-full bg-transparent cursor-text ${worldbuildingEnabled ? '' : 'hide-worldbuilding-links'}`}>
              <EditorContent editor={editor} />
            </div>
          </div>
        )}
      </main>

      <div className="z-30 shrink-0 space-y-2 border-t border-amber-900/40 bg-[#1c1411]/95 p-2 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md sm:p-3">
        {!isPreview && (
          <div className="no-scrollbar mx-auto max-w-4xl overflow-x-auto" onMouseDown={keepEditorFocus}>
            <EditorToolbar editor={editor} onImageError={setImageError} />
          </div>
        )}

        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 border-t border-amber-900/20 pt-1">
          {/* Sur petit écran, les boutons défilent horizontalement au lieu de déborder */}
          <div className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto">
            <button
              onClick={handleCreateVersion}
              disabled={isUpdating || isPreview}
              title="Créer une nouvelle version"
              className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-900/30 bg-neutral-900 px-3 font-sans text-xs font-medium text-amber-200 transition-colors hover:bg-neutral-800 disabled:opacity-40 sm:text-sm"
            >
              <IconAdd className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Nouvelle version</span>
            </button>

            <button
              onClick={() => setIsPreview(!isPreview)}
              title={isPreview ? 'Passer en mode édition' : 'Passer en mode aperçu'}
              className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-900/30 bg-neutral-900 px-3 font-sans text-xs font-medium text-amber-200 transition-colors hover:bg-neutral-800 sm:text-sm"
            >
              {isPreview ? <IconEdit className="size-4" aria-hidden="true" /> : <IconView className="size-4" aria-hidden="true" />}
              <span className="hidden sm:inline">{isPreview ? 'Modifier' : 'Aperçu'}</span>
            </button>

            <button
              onClick={() => setShowMentionDetection(true)}
              disabled={!editor || isPreview || sheets.length === 0}
              title="Repérer les noms de fiches dans le chapitre"
              aria-label="Détecter les fiches"
              className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-800/50 bg-amber-950/40 px-3 font-sans text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/50 disabled:opacity-40 sm:text-sm"
            >
              <span aria-hidden="true">✦</span>
              <span className="hidden sm:inline">Détecter les fiches</span>
            </button>

            <button
              onClick={() => setWorldbuildingEnabled(!worldbuildingEnabled)}
              title={worldbuildingEnabled ? "Masquer le surlignage des liens d'univers" : "Afficher le surlignage des liens d'univers"}
              className={`flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 font-sans text-xs font-medium transition-colors sm:text-sm ${
                worldbuildingEnabled
                  ? 'border-amber-600/60 bg-amber-950/80 text-amber-200'
                  : 'border-amber-900/30 bg-neutral-900 text-amber-200/50 hover:text-amber-200'
              }`}
            >
              <IconSheet className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Worldbuilding</span>
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={isUpdating || isPreview}
            title="Enregistrer les modifications"
            className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-700 px-4 font-sans text-xs font-medium text-amber-50 shadow-md transition-colors hover:bg-amber-600 disabled:opacity-40 sm:px-6 sm:text-sm"
          >
            <IconSave className="size-4" aria-hidden="true" />
            <span>{isUpdating ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </div>
      </div>

      {showMentionDetection && editor && (
        <MentionDetection
          editor={editor}
          sheets={sheets}
          onClose={() => setShowMentionDetection(false)}
        />
      )}
    </div>
  );
}