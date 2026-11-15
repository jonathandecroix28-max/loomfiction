import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { ChapterContent, ChapterHeading, READING_COLUMN, READING_TEXT } from '../components/ChapterReading';
import { useKeyboardViewport } from '../../../hooks/useKeyboardViewport';
import { useLatestGetter } from '../../../hooks/useLatestGetter';
import { offlineChapterService } from '../../../services/offlineChapterService';
import { offlineChapterVersionService } from '../../../services/offlineChapterVersionService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { useUpdateChapter } from '../../chapters/hooks/UseUpdateChapter';
import { useChapterVersions } from '../hooks/useChapterVersions';
import { useChapters } from '../../chapters/hooks/useChapter';
import { notifyDataChanged, useDataChanged } from '../../../hooks/useDataChanged';
import { EditorToolbar } from '../../../components/tools/EditorToolbar';
import { imageFilesFrom, insertImageFiles } from '../../../utils/images/editorImages';
import { createSheetMentionExtension } from '../../editor/extensions/SheetMention';
import { setupMentionPopovers } from '../../editor/utils/setupMentionPopovers';
import { MentionDetection } from '../../editor/components/MentionDetection';
import { ChapterExplorer } from '../components/ChapterExplorer';
import { ChapterModal } from '../../chapters/components/ChapterModal';
import type { ChapterResponse } from '../../../types/chapter';
import type { ChapterVersionResponse } from '../../../types/chapterVersion';
import type { SheetResponse } from '../../../types/sheet';
import {
  IconAdd,
  IconBack,
  IconEdit,
  IconSave,
  IconSheet,
  IconView,
  IconMenu,
  IconClose,
} from '../../../components/icons';

const keepEditorFocus = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('input, textarea, select')) return;
  event.preventDefault();
};

export function ChapterEditorPage() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const chapterIdNumber = chapterId ? Number(chapterId) : null;
  const bookIdNumber = bookId ? Number(bookId) : null;

  const [chapter, setChapter] = useState<ChapterResponse | null>(null);
  const [sheets, setSheets] = useState<SheetResponse[]>([]);
  const [title, setTitle] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [showEditorControls, setShowEditorControls] = useState(true);
  const [worldbuildingEnabled, setWorldbuildingEnabled] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showMentionDetection, setShowMentionDetection] = useState(false);

  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);

  const [activeVersion, setActiveVersion] = useState<ChapterVersionResponse | null>(null);
  const [viewMode, setViewMode] = useState<'diff' | 'edit'>('diff');
  const [hideIdenticalLines, setHideIdenticalLines] = useState(false);
  const [reviewDecisions, setReviewDecisions] = useState<Record<number, boolean>>({});
  const [isReviewPreview, setIsReviewPreview] = useState(false);
  const [reviewPreviewHtml, setReviewPreviewHtml] = useState('');
  const [isApplyingReview, setIsApplyingReview] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const chapterLoadRequestRef = useRef(0);
  const getSheets = useLatestGetter(sheets);

  const { updateChapter, isUpdating, error: updateError } = useUpdateChapter();
  const { versions: chapterVersions, refetch: refetchChapterVersions } = useChapterVersions(chapterIdNumber);
  const { chapters, setChapters, refetch: refetchChapters } = useChapters(bookIdNumber);

  // Mise à jour en direct quand l'explorateur crée un roman, un chapitre ou une version.
  useDataChanged((source) => {
    if (source === 'chapter-page') return;
    void refetchChapters();
    void refetchChapterVersions();
    void offlineSheetService.getAll().then(setSheets).catch(() => undefined);
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      createSheetMentionExtension(getSheets),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: `${READING_TEXT} focus:outline-none min-h-[50vh] pb-24 sm:pb-12 text-base sm:text-lg`,
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

  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Le titre suit le chapitre / la version affichée (ajustement d'état pendant le rendu).
  const titleSource =
    activeVersion && viewMode === 'edit'
      ? activeVersion.name || `Version ${activeVersion.versionNumber}`
      : chapter?.title || '';
  const titleSyncKey = chapter ? `${chapter.id}|${activeVersion?.id ?? ''}|${viewMode}|${titleSource}` : '';
  const [appliedTitleSyncKey, setAppliedTitleSyncKey] = useState('');
  if (chapter && titleSyncKey !== appliedTitleSyncKey) {
    setAppliedTitleSyncKey(titleSyncKey);
    setTitle(titleSource);
  }

  const rootReady = !isPageLoading && !!chapter;

  useEffect(() => {
    if (!rootReady || !rootRef.current || !editor) return;
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
    if (!chapterId) return;
    let isCancelled = false;
    const requestId = ++chapterLoadRequestRef.current;

    const loadData = async () => {
      try {
        setIsPageLoading(true);
        setSaveMessage('');
        setChapter(null);
        setTitle('');
        setIsPreview(false);
        setActiveVersion(null);

        const currentEditor = editorRef.current;
        if (currentEditor && !currentEditor.isDestroyed) {
          currentEditor.commands.clearContent(true);
        }

        const [chapterData, loadedSheets] = await Promise.all([
          offlineChapterService.getById(Number(chapterId)),
          offlineSheetService.getAll(),
        ]);

        if (isCancelled || requestId !== chapterLoadRequestRef.current) return;

        if (!chapterData) {
          navigate('/404', { replace: true });
          return;
        }

        setChapter(chapterData);
        setTitle(chapterData.title);
        setSheets(loadedSheets);
      } catch (error) {
        if (isCancelled || requestId !== chapterLoadRequestRef.current) return;
        console.error('Erreur lors du chargement des données :', error);
        navigate('/404', { replace: true });
      } finally {
        if (!isCancelled && requestId === chapterLoadRequestRef.current) {
          setIsPageLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [chapterId, navigate]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !chapter) return;

    if (activeVersion && viewMode === 'edit') {
      if (editor.getHTML() !== activeVersion.content) {
        editor.commands.setContent(activeVersion.content || '');
      }
    } else {
      if (editor.getHTML() !== chapter.content) {
        editor.commands.setContent(chapter.content || '');
      }
    }
  }, [editor, chapter, activeVersion, viewMode]);

  const handleSave = async () => {
    if (activeVersion && viewMode === 'diff') return;
    if (!chapterId || !chapter || !editor || editor.isDestroyed) return;

    setSaveMessage('');
    const htmlContent = editor.getHTML();

    if (activeVersion && viewMode === 'edit') {
      try {
        const updatedVersions = await offlineChapterVersionService.update(activeVersion.id, {
          ...activeVersion,
          name: title.trim() || activeVersion.name,
          content: htmlContent,
        });
        const currentUpdated = updatedVersions.find((v) => v.id === activeVersion.id);
        if (currentUpdated) {
          setActiveVersion(currentUpdated);
        }
        await refetchChapterVersions();
        notifyDataChanged('chapter-page');
        setSaveMessage('Version enregistrée');
        setTimeout(() => setSaveMessage(''), 3000);
      } catch (err) {
        console.error('Erreur sauvegarde version :', err);
        setSaveMessage('Erreur sauvegarde version.');
      }
      return;
    }

    const updated = await updateChapter(Number(chapterId), title, htmlContent);

    if (updated) {
      setChapter(updated);
      notifyDataChanged('chapter-page');
      setSaveMessage('Enregistré');
      setTimeout(() => setSaveMessage(''), 3000);
    } else if (updateError) {
      setSaveMessage('Erreur sauvegarde.');
    }
  };

  const handleCreateVersion = async () => {
    if (!chapterId || !chapter || !editor || editor.isDestroyed || activeVersion) return;

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
      notifyDataChanged('chapter-page');
      setSaveMessage(`v${nextVersionNumber} créée.`);
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la création de version :', error);
      setSaveMessage('Erreur version.');
    }
  };

  const handleNavigate = async (newChapterId: number) => {
    if (editor && !editor.isDestroyed && chapter && !activeVersion && (editor.getHTML() !== chapter.content || title !== chapter.title)) {
      await updateChapter(Number(chapterId), title, editor.getHTML());
    }
    navigate(`/books/${bookId}/chapters/${newChapterId}`);
  };

  const diffGroups = useMemo(() => {
    type HtmlBlock = { html: string; text: string };
    type EqualGroup = { type: 'equal'; oldBlock: HtmlBlock; currentBlock: HtmlBlock; oldLine: number; currentLine: number };
    type ChangeGroup = { type: 'change'; id: number; oldBlocks: HtmlBlock[]; currentBlocks: HtmlBlock[]; oldStart: number; currentStart: number };

    if (!activeVersion || viewMode !== 'diff' || !chapter) {
      return { groups: [] as Array<EqualGroup | ChangeGroup>, rows: [] as Array<{ left: string | null; right: string | null; type: 'equal' | 'removed' | 'added'; leftLine: number | null; rightLine: number | null; hunkId: number | null }> }; 
    }

    const htmlToBlocks = (html: string): HtmlBlock[] => {
      const container = document.createElement('div');
      container.innerHTML = html || '';
      return Array.from(container.childNodes).flatMap((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent || '').trim();
          if (!text) return [];
          const paragraph = document.createElement('p');
          paragraph.textContent = text;
          return [{ html: paragraph.outerHTML, text: text.replace(/\s+/g, ' ').trim() }];
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return [];
        const element = node as HTMLElement;
        const text = (element.textContent || element.getAttribute('alt') || element.querySelector('img')?.getAttribute('alt') || (element.tagName === 'P' ? '' : '[Élément intégré]'))
          .replace(/\s+/g, ' ').trim();
        return [{ html: element.outerHTML, text }];
      });
    };

    const oldBlocks = htmlToBlocks(activeVersion.content || '');
    const currentBlocks = htmlToBlocks(chapter.content || '');
    const maxCells = 2_000_000;
    const events: Array<{ type: 'equal' | 'removed' | 'added'; oldIndex?: number; currentIndex?: number }> = [];

    if (oldBlocks.length * currentBlocks.length > maxCells) {
      oldBlocks.forEach((_, oldIndex) => events.push({ type: 'removed', oldIndex }));
      currentBlocks.forEach((_, currentIndex) => events.push({ type: 'added', currentIndex }));
    } else {
      const dp = Array.from({ length: oldBlocks.length + 1 }, () => new Uint32Array(currentBlocks.length + 1));
      for (let i = oldBlocks.length - 1; i >= 0; i--) {
        for (let j = currentBlocks.length - 1; j >= 0; j--) {
          dp[i][j] = oldBlocks[i].text === currentBlocks[j].text
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      let i = 0;
      let j = 0;
      while (i < oldBlocks.length && j < currentBlocks.length) {
        if (oldBlocks[i].text === currentBlocks[j].text) {
          events.push({ type: 'equal', oldIndex: i++, currentIndex: j++ });
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
          events.push({ type: 'removed', oldIndex: i++ });
        } else {
          events.push({ type: 'added', currentIndex: j++ });
        }
      }
      while (i < oldBlocks.length) events.push({ type: 'removed', oldIndex: i++ });
      while (j < currentBlocks.length) events.push({ type: 'added', currentIndex: j++ });
    }

    const groups: Array<EqualGroup | ChangeGroup> = [];
    let cursor = 0;
    let changeId = 0;
    while (cursor < events.length) {
      const event = events[cursor];
      if (event.type === 'equal') {
        const oldIndex = event.oldIndex!;
        const currentIndex = event.currentIndex!;
        groups.push({ type: 'equal', oldBlock: oldBlocks[oldIndex], currentBlock: currentBlocks[currentIndex], oldLine: oldIndex + 1, currentLine: currentIndex + 1 });
        cursor++;
        continue;
      }
      const oldIndexes: number[] = [];
      const currentIndexes: number[] = [];
      while (cursor < events.length && events[cursor].type !== 'equal') {
        const changed = events[cursor++];
        if (changed.type === 'removed') oldIndexes.push(changed.oldIndex!);
        if (changed.type === 'added') currentIndexes.push(changed.currentIndex!);
      }
      groups.push({
        type: 'change',
        id: changeId++,
        oldBlocks: oldIndexes.map((index) => oldBlocks[index]),
        currentBlocks: currentIndexes.map((index) => currentBlocks[index]),
        oldStart: oldIndexes.length ? oldIndexes[0] + 1 : 0,
        currentStart: currentIndexes.length ? currentIndexes[0] + 1 : 0,
      });
    }

    const rows: Array<{
      left: string | null; right: string | null; type: 'equal' | 'removed' | 'added';
      leftLine: number | null; rightLine: number | null; hunkId: number | null;
    }> = [];
    groups.forEach((group) => {
      if (group.type === 'equal') {
        rows.push({ left: group.oldBlock.text, right: group.currentBlock.text, type: 'equal', leftLine: group.oldLine, rightLine: group.currentLine, hunkId: null });
      } else {
        group.oldBlocks.forEach((block, index) => rows.push({ left: block.text, right: null, type: 'removed', leftLine: group.oldStart + index, rightLine: null, hunkId: group.id }));
        group.currentBlocks.forEach((block, index) => rows.push({ left: null, right: block.text, type: 'added', leftLine: null, rightLine: group.currentStart + index, hunkId: group.id }));
      }
    });
    return { groups, rows };
  }, [activeVersion, viewMode, chapter]);

  const visibleDiffRows = useMemo(
    () => hideIdenticalLines ? diffGroups.rows.filter((row) => row.type !== 'equal') : diffGroups.rows,
    [diffGroups, hideIdenticalLines],
  );

  const changeGroups = useMemo(
    () => diffGroups.groups.filter((group) => group.type === 'change'),
    [diffGroups],
  );

  const buildReviewPreview = () => {
    const html = diffGroups.groups.flatMap((group) => {
      if (group.type === 'equal') return [group.currentBlock.html];
      const keepCurrent = reviewDecisions[group.id] !== false;
      return (keepCurrent ? group.currentBlocks : group.oldBlocks).map((block) => block.html);
    }).join('');
    setReviewPreviewHtml(html);
    setIsReviewPreview(true);
  };

  const handleApplyReview = async () => {
    if (!chapterId || !chapter || !isReviewPreview || isApplyingReview) return;
    setIsApplyingReview(true);
    setSaveMessage('');
    try {
      const updated = await updateChapter(Number(chapterId), chapter.title, reviewPreviewHtml);
      if (!updated) {
        setSaveMessage('La validation a échoué. Le chapitre n’a pas été remplacé.');
        return;
      }
      setChapter(updated);
      notifyDataChanged('chapter-page');
      setTitle(updated.title);
      setActiveVersion(null);
      setIsReviewPreview(false);
      setReviewPreviewHtml('');
      setReviewDecisions({});
      setHideIdenticalLines(false);
      setSaveMessage('Modifications appliquées au chapitre.');
    } catch (error) {
      console.error('Erreur lors de la validation du diff :', error);
      setSaveMessage('Erreur lors de la validation des modifications.');
    } finally {
      setIsApplyingReview(false);
    }
  };

  if (isPageLoading && !chapter) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[var(--c-page)] font-serif text-amber-200/60">
        Ouverture de l'écritoire...
      </div>
    );
  }

  if (!chapter) return null;

  const chapterNum = chapter?.chapter_number ?? 1;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--c-page)] font-serif text-[var(--c-ink)]">
      
      <ChapterExplorer
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        bookId={Number(bookId)}
        currentChapterId={Number(chapterId)}
        onNavigate={handleNavigate}
        onSelectVersion={(version) => {
          setActiveVersion(version);
          setViewMode('diff');
          setHideIdenticalLines(false);
          setReviewDecisions({});
          setIsReviewPreview(false);
          setReviewPreviewHtml('');
        }}
      />

      <div ref={rootRef} className="flex-1 flex flex-col min-w-0 h-[100dvh] relative">
        <header className="z-20 flex shrink-0 items-center justify-between border-b border-amber-900/40 bg-[var(--c-surface)]/95 px-2.5 py-2 shadow-md backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {!isExplorerOpen && (
              <button
                onClick={() => setIsExplorerOpen(true)}
                title="Ouvrir l'explorateur"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-amber-200/70 transition-colors hover:bg-amber-900/20 hover:text-amber-100 touch-target"
              >
                <IconMenu className="size-5" aria-hidden="true" />
              </button>
            )}

            <button
              onClick={() => {
                if (activeVersion) {
                  setActiveVersion(null);
                  setIsReviewPreview(false);
                } else {
                  navigate(-1);
                }
              }}
              title="Retour"
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-sans text-amber-200/70 transition-colors hover:bg-amber-900/20 hover:text-amber-100 touch-target"
            >
              <IconBack className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{activeVersion ? 'Chapitre actuel' : 'Retour'}</span>
            </button>

            <span className="text-xs text-amber-900/50 hidden sm:inline">|</span>

            <span className="whitespace-nowrap font-sans text-xs font-medium text-amber-200/80 sm:text-sm truncate">
              Ch. {chapterNum} {activeVersion ? `(v${activeVersion.versionNumber})` : ''}
            </span>
          </div>

          {activeVersion && (
            <div className="flex items-center gap-2">
              {isReviewPreview ? (
                <>
                  <span className="hidden sm:inline font-sans text-xs text-emerald-300">Prévisualisation du résultat</span>
                  <button onClick={() => setIsReviewPreview(false)} className="rounded-lg border border-amber-900/40 px-3 py-2 font-sans text-xs text-amber-200 hover:bg-amber-900/20">Retour au diff</button>
                </>
              ) : (
                <div className="flex p-1 bg-neutral-900/95 rounded-lg border border-amber-900/30 text-xs font-sans">
                  <button onClick={() => setViewMode('diff')} className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'diff' ? 'bg-amber-700 text-amber-50' : 'text-amber-200/70 hover:text-amber-100'}`}>Vue Diff</button>
                  <button onClick={() => setViewMode('edit')} className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'edit' ? 'bg-amber-700 text-amber-50' : 'text-amber-200/70 hover:text-amber-100'}`}>Modifier cette version</button>
                </div>
              )}
              <button onClick={() => { setActiveVersion(null); setIsReviewPreview(false); }} className="flex items-center gap-1 p-2 bg-neutral-900 border border-amber-900/30 rounded-lg text-amber-200 hover:bg-neutral-800 transition-colors" title="Fermer la version">
                <IconClose className="size-4" />
              </button>
            </div>
          )}

          {saveMessage && (
            <span className="max-w-[100px] sm:max-w-none animate-pulse truncate font-sans text-[11px] font-medium text-emerald-400">
              {saveMessage}
            </span>
          )}
        </header>

        {activeVersion && viewMode === 'diff' && !isReviewPreview ? (
          <main className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#1e1e1e] font-mono text-xs sm:text-sm">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-900/30 bg-[#252526] px-3 py-2 font-sans">
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input type="checkbox" checked={hideIdenticalLines} onChange={(event) => setHideIdenticalLines(event.target.checked)} className="accent-amber-600" />
                Masquer les lignes identiques
              </label>
              <span className="text-[11px] text-neutral-400">{changeGroups.length} changement(s) à examiner</span>
              <button onClick={buildReviewPreview} disabled={changeGroups.length === 0} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40">Prévisualiser le résultat</button>
            </div>
            {changeGroups.length > 0 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-amber-900/30 bg-[#222] p-2">
                {changeGroups.map((group, index) => (
                  <div key={group.id} className="flex shrink-0 items-center gap-2 rounded-lg border border-neutral-700 bg-[#292929] px-2 py-1.5">
                    <span className="font-sans text-[11px] text-neutral-300">Changement {index + 1}</span>
                    <button onClick={() => setReviewDecisions((current) => ({ ...current, [group.id]: true }))} className={`rounded px-2 py-1 font-sans text-[11px] ${reviewDecisions[group.id] === true ? 'bg-emerald-700 text-white' : 'bg-neutral-700 text-neutral-200 hover:bg-emerald-900'}`}>Accepter</button>
                    <button onClick={() => setReviewDecisions((current) => ({ ...current, [group.id]: false }))} className={`rounded px-2 py-1 font-sans text-[11px] ${reviewDecisions[group.id] === false ? 'bg-red-800 text-white' : 'bg-neutral-700 text-neutral-200 hover:bg-red-950'}`}>Rejeter</button>
                    <span className="font-sans text-[10px] text-neutral-500">{reviewDecisions[group.id] === undefined ? 'En attente' : reviewDecisions[group.id] ? 'Accepté' : 'Rejeté'}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Desktop : comparaison classique en deux colonnes synchronisées visuellement. */}
            <div className="hidden md:grid min-h-0 flex-1 grid-cols-2 divide-x divide-amber-900/30 overflow-y-auto">
              <section className="min-w-0">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-900/30 bg-[#252526] px-4 py-3 font-sans text-amber-200/70">
                  <span>v{activeVersion.versionNumber} {activeVersion.name ? `- ${activeVersion.name}` : ''}</span>
                  <span className="rounded bg-red-950/80 px-2 py-0.5 text-[10px] uppercase text-red-300">Ancienne version</span>
                </div>
                <div className="space-y-0.5 p-3">
                  {visibleDiffRows.map((row, idx) => (
                    <div key={`old-${idx}`} className={`flex min-h-7 rounded px-2 py-1 ${row.type === 'removed' ? 'bg-red-950/50 text-red-200' : row.type === 'equal' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      <span className="w-9 shrink-0 select-none pr-3 text-right text-neutral-500">{row.leftLine ?? ''}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{row.left ?? ' '}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="min-w-0">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-900/30 bg-[#252526] px-4 py-3 font-sans text-amber-200/70">
                  <span>Manuscrit actuel</span>
                  <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] uppercase text-emerald-300">Actuel</span>
                </div>
                <div className="space-y-0.5 p-3">
                  {visibleDiffRows.map((row, idx) => (
                    <div key={`new-${idx}`} className={`flex min-h-7 rounded px-2 py-1 ${row.type === 'added' ? 'bg-emerald-950/50 text-emerald-200' : row.type === 'equal' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      <span className="w-9 shrink-0 select-none pr-3 text-right text-neutral-500">{row.rightLine ?? ''}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{row.right ?? ' '}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Mobile : un seul flux avec les suppressions puis les ajouts en contexte. */}
            <section className="md:hidden min-h-0 flex-1 overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-900/30 bg-[#252526] px-3 py-3 font-sans text-amber-200/70">
                <span>Comparaison avec v{activeVersion.versionNumber}</span>
                <span className="text-[10px] text-neutral-400">− supprimé · + ajouté</span>
              </div>
              <div className="space-y-1 p-3">
                {visibleDiffRows.map((row, idx) => {
                  const isRemoved = row.type === 'removed';
                  const isAdded = row.type === 'added';
                  const lineNumber = isRemoved ? row.leftLine : row.rightLine;
                  const marker = isRemoved ? '−' : isAdded ? '+' : ' ';
                  const value = isRemoved ? row.left : row.right;

                  return (
                    <div
                      key={`mobile-${idx}`}
                      className={`flex min-h-8 rounded px-2 py-1.5 ${
                        isRemoved
                          ? 'border-l-2 border-red-500 bg-red-950/50 text-red-200'
                          : isAdded
                            ? 'border-l-2 border-emerald-500 bg-emerald-950/50 text-emerald-200'
                            : 'border-l-2 border-transparent text-neutral-300'
                      }`}
                    >
                      <span className="w-9 shrink-0 select-none pr-2 text-right tabular-nums text-neutral-500">
                        {lineNumber ?? ''}
                      </span>
                      <span className={`w-5 shrink-0 select-none text-center font-bold ${
                        isRemoved ? 'text-red-400' : isAdded ? 'text-emerald-400' : 'text-transparent'
                      }`}>
                        {marker}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{value || ' '}</span>
                    </div>
                  );
                })}
                {diffGroups.rows.length === 0 && (
                  <p className="py-8 text-center font-sans text-neutral-400">Aucune différence détectée.</p>
                )}
              </div>
            </section>
          </main>
        ) : (
          <main className={`flex-1 overflow-y-auto w-full flex flex-col ${isReviewPreview || isPreview ? 'p-4' : 'px-3 sm:px-6 pt-4 sm:pt-6'}`}>
            {isReviewPreview ? (
              <div className={READING_COLUMN}>
                <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 font-sans text-sm text-emerald-200">Aperçu uniquement : le chapitre n'est pas encore modifié.</div>
                <ChapterHeading>{chapter.title}</ChapterHeading>
                <ChapterContent html={reviewPreviewHtml} />
              </div>
            ) : isPreview ? (
              <div className={READING_COLUMN}>
                <ChapterHeading>{title}</ChapterHeading>
                <ChapterContent html={previewHtml} />
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
                {activeVersion && viewMode === 'edit' && (
                  <div className="mb-2 p-2 bg-amber-950/40 border border-amber-600/40 rounded-xl text-xs text-amber-200 font-sans flex items-center justify-between">
                    <span>⚠️ Vous modifiez directement l'archive <strong>v{activeVersion.versionNumber}</strong>.</span>
                  </div>
                )}

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre du chapitre..."
                  className="mb-3 sm:mb-4 shrink-0 border-b border-amber-900/30 bg-transparent pb-2.5 font-serif text-xl sm:text-3xl md:text-4xl font-bold text-amber-100 placeholder:text-amber-200/30 focus:border-amber-600 focus:outline-none"
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
        )}

        {showEditorControls ? (
        <div className="relative z-30 shrink-0 space-y-1.5 border-t border-amber-900/40 bg-[var(--c-surface)]/95 p-2 shadow-lg backdrop-blur-md sm:p-3">
          <div className="mx-auto flex max-w-4xl justify-end">
            <button
              type="button"
              onClick={() => setShowEditorControls(false)}
              title="Masquer la barre d’outils et tous ses boutons"
              aria-label="Masquer la barre d’outils et tous ses boutons"
              className="rounded-lg px-2.5 py-1 font-sans text-xs text-amber-200/70 transition-colors hover:bg-amber-900/20 hover:text-amber-100"
            >
              Masquer les outils <span aria-hidden="true">⌄</span>
            </button>
          </div>
          {!isReviewPreview && !isPreview && (!activeVersion || viewMode === 'edit') && (
            <div className="no-scrollbar mx-auto max-w-4xl overflow-x-auto" onMouseDown={keepEditorFocus}>
              <EditorToolbar editor={editor} onImageError={setImageError} />
            </div>
          )}

          {isReviewPreview ? (
            <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 pt-1">
              <button onClick={() => setIsReviewPreview(false)} className="rounded-xl border border-amber-900/40 px-4 py-2 font-sans text-xs text-amber-200 hover:bg-amber-900/20">Revenir aux changements</button>
              <button onClick={handleApplyReview} disabled={isApplyingReview} className="rounded-xl bg-emerald-700 px-4 py-2 font-sans text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{isApplyingReview ? 'Validation…' : 'Confirmer et appliquer'}</button>
            </div>
          ) : (
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-1.5 sm:gap-2 border-t border-amber-900/20 pt-1.5">
            <div className="no-scrollbar flex min-w-0 items-center gap-1 sm:gap-2 overflow-x-auto py-0.5">
              <button
                onClick={handleCreateVersion}
                disabled={isUpdating || isPreview || !!activeVersion}
                title={activeVersion ? "Désactivé en mode édition d'archive" : "Nouvelle version"}
                className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-amber-900/30 bg-[var(--c-surface-2)] px-2.5 sm:px-3 font-sans text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/30 disabled:opacity-40 disabled:cursor-not-allowed touch-target"
              >
                <IconAdd className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">Version</span>
              </button>

              <button
                onClick={() => setIsPreview(!isPreview)}
                disabled={!!activeVersion && viewMode === 'diff'}
                title={isPreview ? 'Modifier' : 'Aperçu'}
                className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-amber-900/30 bg-[var(--c-surface-2)] px-2.5 sm:px-3 font-sans text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/30 disabled:opacity-40 touch-target"
              >
                {isPreview ? <IconEdit className="size-4" aria-hidden="true" /> : <IconView className="size-4" aria-hidden="true" />}
                <span className="hidden md:inline">{isPreview ? 'Modifier' : 'Aperçu'}</span>
              </button>

              <button
                onClick={() => setShowMentionDetection(true)}
                disabled={!editor || isPreview || sheets.length === 0 || (!!activeVersion && viewMode === 'diff')}
                title="Détecter les fiches"
                className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-amber-800/50 bg-amber-950/40 px-2.5 sm:px-3 font-sans text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/50 disabled:opacity-40 touch-target"
              >
                <span aria-hidden="true">✦</span>
                <span className="hidden lg:inline">Fiches</span>
              </button>

              <button
                onClick={() => setWorldbuildingEnabled(!worldbuildingEnabled)}
                title="Worldbuilding"
                className={`flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border px-2.5 sm:px-3 font-sans text-xs font-medium transition-colors touch-target ${
                  worldbuildingEnabled
                    ? 'border-amber-600/60 bg-amber-950/80 text-amber-200'
                    : 'border-amber-900/30 bg-[var(--c-surface-2)] text-amber-200/50 hover:text-amber-200'
                }`}
              >
                <IconSheet className="size-4" aria-hidden="true" />
                <span className="hidden lg:inline">Univers</span>
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={isUpdating || isPreview || (!!activeVersion && viewMode === 'diff')}
              title={activeVersion && viewMode === 'diff' ? "Impossible d'enregistrer en mode comparaison" : "Enregistrer"}
              className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-700 px-3 sm:px-5 font-sans text-xs font-medium text-amber-50 shadow-md transition-colors hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed touch-target"
            >
              <IconSave className="size-4" aria-hidden="true" />
              <span className="text-xs">{isUpdating ? '...' : (activeVersion && viewMode === 'edit' ? 'Enregistrer version' : 'Enregistrer')}</span>
            </button>
          </div>
          )}
        </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowEditorControls(true)}
            title="Afficher la barre d’outils et tous ses boutons"
            aria-label="Afficher la barre d’outils et tous ses boutons"
            className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-amber-700/50 bg-[var(--c-surface)]/95 px-4 py-2.5 font-sans text-xs font-medium text-amber-100 shadow-xl backdrop-blur-md transition-colors hover:bg-amber-900/50"
          >
            <span aria-hidden="true">⌃</span>
            Afficher les outils
          </button>
        )}
      </div>

      {showMentionDetection && editor && (
        <MentionDetection
          editor={editor}
          sheets={sheets}
          onClose={() => setShowMentionDetection(false)}
        />
      )}

      {chapter && (
        <ChapterModal
          isOpen={isChapterModalOpen}
          onClose={() => setIsChapterModalOpen(false)}
          bookId={Number(bookId)}
          nextChapterNumber={chapters.length > 0 ? Math.max(...chapters.map(c => c.chapter_number)) + 1 : 1}
          onChapterCreated={(newChapters) => {
            setChapters(newChapters);
            notifyDataChanged('chapter-page');
            const newChapter = newChapters[newChapters.length - 1];
            navigate(`/books/${bookId}/chapters/${newChapter.id}`);
            setIsChapterModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default ChapterEditorPage;