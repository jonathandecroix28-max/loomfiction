import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChapterVersions } from '../hooks/useChapterVersions';
import { offlineChapterService } from '../../../services/offlineChapterService';
import { offlineChapterVersionService } from '../../../services/offlineChapterVersionService';
import type { ChapterVersionResponse } from '../../../types/chapterVersion';
import { useParentItem, useVersionCompare } from '../../../hooks/versions/useVersionCompare';
import { htmlToText } from '../../../utils/versions/htmlText';
import {
  FeedbackBanner,
  MergeOptions,
  VersionsError,
  VersionsFilterBar,
  VersionsHeader,
  VersionsLoading,
} from '../../../components/versions/VersionParts';
import { VersionList } from '../../../components/versions/VersionList';
import { useConfirm } from '../../../components/feedback/FeedbackProvider';
import { IconClose } from '../../../components/icons';

const MERGE_FIELDS = [
  { key: 'title', label: 'Titre' },
  { key: 'content', label: 'Contenu' },
] as const;

const getContent = (version: ChapterVersionResponse) => version.content ?? '';

export function ChapterVersionsPage() {
  const { bookId, chapterId, versionId } = useParams<{ bookId: string; chapterId: string; versionId?: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const numBookId = bookId ? Number(bookId) : null;
  const numChapterId = chapterId ? Number(chapterId) : null;
  const numVersionId = versionId ? Number(versionId) : null;
  const editorPath = `/books/${numBookId}/chapters/${numChapterId}`;

  const { versions, selectedVersion, isLoading, error, refetch } = useChapterVersions(numChapterId, numVersionId);
  const { item: chapter, loading: chapterLoading } = useParentItem(numChapterId, offlineChapterService.getById);

  const compare = useVersionCompare({
    versions,
    selectedVersion,
    currentText: chapter?.content || '',
    getText: getContent,
    richText: true,
  });

  const [mergeFields, setMergeFields] = useState({ title: true, content: true });
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!isLoading && !chapterLoading && (error || !chapter)) {
      navigate('/404', { replace: true });
    }
  }, [isLoading, chapterLoading, error, chapter, navigate]);

  const handleMerge = async (version: ChapterVersionResponse) => {
    if (!numChapterId || !chapter) return;

    setIsRestoring(true);
    try {
      await offlineChapterService.update(
        numChapterId,
        mergeFields.title ? version.name : chapter.title,
        mergeFields.content ? compare.mergeFor(version) : chapter.content
      );
      setFeedback('Fusion appliquée au chapitre courant.');
      navigate(editorPath);
    } catch (restoreError) {
      console.error('Erreur lors de la restauration de la version :', restoreError);
      setFeedback('Impossible de restaurer cette version.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (version: ChapterVersionResponse) => {
    const ok = await confirm({
      title: `Supprimer la version ${version.versionNumber} ?`,
      message: 'Cette action est irréversible.',
      tone: 'danger',
    });
    if (!ok) return;

    const success = await offlineChapterVersionService.remove(version.id);
    if (success) {
      setFeedback(`Version ${version.versionNumber} supprimée.`);
      await refetch();
      return;
    }
    setFeedback('Impossible de supprimer cette version.');
  };

  const diffLines = useMemo(() => {
    if (!compare.versionToCompare || !chapter) return { leftLines: [], rightLines: [] };
    
    const stripHtml = (html: string) => htmlToText(html).split('\n');
    const leftLines = stripHtml(compare.versionToCompare.content || '');
    const rightLines = stripHtml(chapter.content || '');

    return { leftLines, rightLines };
  }, [compare.versionToCompare, chapter]);

  if (isLoading || chapterLoading) return <VersionsLoading />;
  if (error || !chapter) return <VersionsError message={error ?? 'Ce chapitre n’existe plus ou est introuvable.'} />;

  const { versionToCompare } = compare;

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#1c1411] text-[#fcf9f2] font-serif">
      <VersionsHeader
        title="Versions du chapitre"
        subtitle={chapter.title}
        backLabel="Retour à l'écritoire"
        openLabel="Ouvrir l’éditeur"
        onBack={() => navigate(editorPath)}
        versionsCount={versions.length}
        selectedNumber={selectedVersion?.versionNumber ?? null}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6 overflow-x-hidden">
        <FeedbackBanner message={feedback} />

        <VersionsFilterBar
          search={compare.search}
          onSearch={compare.setSearch}
          sortBy={compare.sortBy}
          onSort={compare.setSortBy}
        />

        <div className="flex flex-col gap-4 sm:gap-6">
          <VersionList
            versions={compare.visibleVersions}
            selectedId={selectedVersion?.id ?? null}
            isRestoring={isRestoring}
            onView={(version) => navigate(`${editorPath}/versions/${version.id}`)}
            onMerge={handleMerge}
            onDelete={handleDelete}
          />

          {versionToCompare && (
            <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/70 p-3 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-200/40 mb-1">Comparaison visuelle</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-amber-100">
                    v{versionToCompare.versionNumber} {versionToCompare.name ? `- ${versionToCompare.name}` : ''} vs Manuscrit Actuel
                  </h2>
                </div>
                <button
                  onClick={() => navigate(editorPath)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-amber-900/30 rounded-lg text-xs font-sans text-amber-200 hover:bg-neutral-800 transition-colors"
                >
                  <IconClose className="size-3.5" />
                  Fermer
                </button>
              </div>

              {/* Vue Split / Diff côte à côte façon VS Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-amber-900/30 bg-[#1e1e1e] rounded-xl overflow-hidden border border-amber-900/30 font-mono text-xs sm:text-sm">
                
                {/* Colonne Gauche : Ancienne Version (Rouge) */}
                <div className="flex flex-col h-96 overflow-y-auto">
                  <div className="sticky top-0 bg-[#252526] px-4 py-2 border-b border-amber-900/30 text-amber-200/60 font-sans flex justify-between items-center z-10">
                    <span>v{versionToCompare.versionNumber}</span>
                    <span className="text-[10px] uppercase bg-red-950/80 text-red-300 px-2 py-0.5 rounded">Ancienne version</span>
                  </div>
                  <div className="p-4 space-y-1">
                    {diffLines.leftLines.map((line, idx) => (
                      <div key={idx} className="flex bg-red-950/30 text-red-200 px-2 py-0.5 rounded">
                        <span className="w-8 select-none text-red-500/50 text-right pr-3">{idx + 1}</span>
                        <span className="flex-1 whitespace-pre-wrap">{line || ' '}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Colonne Droite : Manuscrit Actuel (Vert) */}
                <div className="flex flex-col h-96 overflow-y-auto">
                  <div className="sticky top-0 bg-[#252526] px-4 py-2 border-b border-amber-900/30 text-amber-200/60 font-sans flex justify-between items-center z-10">
                    <span>Actuel</span>
                    <span className="text-[10px] uppercase bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded">Actuel</span>
                  </div>
                  <div className="p-4 space-y-1">
                    {diffLines.rightLines.map((line, idx) => (
                      <div key={idx} className="flex bg-emerald-950/30 text-emerald-200 px-2 py-0.5 rounded">
                        <span className="w-8 select-none text-emerald-500/50 text-right pr-3">{idx + 1}</span>
                        <span className="flex-1 whitespace-pre-wrap">{line || ' '}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <MergeOptions
                fields={MERGE_FIELDS}
                value={mergeFields}
                onChange={setMergeFields}
                onMerge={() => handleMerge(versionToCompare)}
                isRestoring={isRestoring}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default ChapterVersionsPage;