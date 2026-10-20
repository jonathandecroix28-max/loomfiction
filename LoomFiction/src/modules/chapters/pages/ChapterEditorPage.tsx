import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import DOMPurify from 'dompurify'; 
import { offlineChapterService } from '../../../services/offlineChapterService';
import { offlineChapterVersionService } from '../../../services/offlineChapterVersionService';
import { useUpdateChapter } from '../../chapters/hooks/UseUpdateChapter';
import { useChapterVersions } from '../hooks/useChapterVersions';
import { EditorToolbar } from '../../../components/tools/EditorToolbar';
import { imageFilesFrom, insertImageFiles } from '../../../utils/images/editorImages';
import type { ChapterResponse } from '../../../types/chapter';
import type { ChapterVersionResponse } from '../../../types/chapterVersion';

export function ChapterEditorPage() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const chapterIdNumber = chapterId ? Number(chapterId) : null;

  const [chapter, setChapter] = useState<ChapterResponse | null>(null);
  const [title, setTitle] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [isPreview, setIsPreview] = useState(false); 
  const [imageError, setImageError] = useState<string | null>(null);

  const { updateChapter, isUpdating, error: updateError } = useUpdateChapter();
  const { versions: chapterVersions, refetch: refetchChapterVersions } = useChapterVersions(chapterIdNumber);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[60vh] text-lg leading-relaxed text-amber-100/90 font-serif',
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

  useEffect(() => {
    if (!imageError) return;
    const timer = setTimeout(() => setImageError(null), 6000);
    return () => clearTimeout(timer);
  }, [imageError]);

  useEffect(() => {
    const fetchChapter = async () => {
      if (!chapterId) return;
      try {
        setIsPageLoading(true);
        const data = await offlineChapterService.getById(Number(chapterId));
        
        if (!data) {
          navigate('/404', { replace: true });
          return;
        }

        setChapter(data);
        setTitle(data.title);
      } catch (error) {
        console.error("Erreur lors du chargement du chapitre :", error);
        navigate('/404', { replace: true });
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchChapter();
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
      setSaveMessage('Enregistré ! ✨');
      setTimeout(() => setSaveMessage(''), 3000);
    } else if (updateError) {
      setSaveMessage('Erreur sauvegarde.');
    }
  };

  const handleCreateVersion = async () => {
    if (!chapterId || !chapter || !editor) return;

    const nextVersionNumber = chapterVersions.length > 0
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
      <div className="min-h-screen bg-[#1c1411] flex items-center justify-center font-serif text-amber-200/60">
        Ouverture de l'écritoire...
      </div>
    );
  }

  if (!chapter) return null;

  const chapterNum = chapter?.chapter_number ?? 1;

  return (
    <div className="min-h-screen bg-[#1c1411] text-[#fcf9f2] flex flex-col font-serif overflow-x-hidden">
      
      {/* HEADER FIXE (Navigation seule) */}
      <header className="sticky top-0 z-20 bg-[#1c1411]/95 backdrop-blur-md border-b border-amber-900/40 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate(-1)}
            title="Retour"
            className="h-9 px-2 sm:px-2.5 rounded-lg text-amber-200/70 hover:text-amber-100 hover:bg-neutral-900 text-xs sm:text-sm font-sans flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
          >
            &larr; <span className="hidden sm:inline">Retour</span>
          </button>
          
          <span className="text-amber-900/50 text-xs">|</span>
          
          <span className="text-xs sm:text-sm font-sans text-amber-200/80 font-medium whitespace-nowrap">
            Ch. {chapterNum}
          </span>
          
          <button
            onClick={() => navigate(`/books/${bookId}/chapters/${chapterId}/versions`)}
            title="Historique des versions"
            className="h-9 px-2 sm:px-3 rounded-lg border border-amber-900/30 bg-neutral-900 hover:bg-neutral-800 text-amber-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>📜</span>
            <span className="hidden sm:inline">Versions</span>
          </button>
        </div>

        {saveMessage && (
          <span className="text-[11px] font-sans text-emerald-400 font-medium animate-pulse truncate max-w-[120px] sm:max-w-none">
            {saveMessage}
          </span>
        )}
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6 pb-28 sm:pb-36 flex flex-col">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPreview}
          placeholder="Titre du chapitre..."
          className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif text-amber-100 bg-transparent border-b border-amber-900/30 pb-3 mb-4 focus:outline-none focus:border-amber-600 placeholder:text-amber-200/30 disabled:border-transparent"
        />

        {isPreview ? (
          <div 
            className="prose prose-invert max-w-none text-lg leading-relaxed text-amber-100/90 font-serif py-4"
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(editor ? editor.getHTML() : '') 
            }} 
          />
        ) : (
          <>
            {imageError && (
              <p role="alert" className="text-sm font-sans text-red-400 mb-3">
                {imageError}
              </p>
            )}
            <div className="flex-1 w-full bg-transparent cursor-text mt-2">
              <EditorContent editor={editor} />
            </div>
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#1c1411]/95 backdrop-blur-md border-t border-amber-900/40 p-2 sm:p-3 shadow-2xl space-y-2">
        
        {!isPreview && (
          <div className="max-w-4xl mx-auto overflow-x-auto no-scrollbar">
            <EditorToolbar editor={editor} onImageError={setImageError} />
          </div>
        )}

        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 pt-1 border-t border-amber-900/20">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateVersion}
              disabled={isUpdating || isPreview}
              title="Créer une nouvelle version"
              className="h-9 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-200 font-sans text-xs sm:text-sm font-medium transition-colors cursor-pointer border border-amber-900/30 disabled:opacity-40 flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>➕</span>
              <span className="hidden sm:inline">Nouvelle version</span>
            </button>

            <button
              onClick={() => setIsPreview(!isPreview)}
              title={isPreview ? "Passer en mode édition" : "Passer en mode aperçu"}
              className="h-9 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-200 font-sans text-xs sm:text-sm font-medium transition-colors cursor-pointer border border-amber-900/30 flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>{isPreview ? "✏️" : "👁️"}</span>
              <span className="hidden sm:inline">{isPreview ? "Modifier" : "Aperçu"}</span>
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={isUpdating || isPreview}
            title="Enregistrer les modifications"
            className="h-9 px-4 sm:px-6 rounded-xl bg-amber-700 hover:bg-amber-600 text-amber-50 font-sans text-xs sm:text-sm font-medium transition-colors shadow-md cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>💾</span>
            <span>{isUpdating ? "Enregistrement..." : "Enregistrer"}</span>
          </button>
        </div>
      </div>

    </div>
  );
}