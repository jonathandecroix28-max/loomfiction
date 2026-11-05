import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useChapterVersions } from '../hooks/useChapterVersions';
import { offlineChapterService } from '../../../services/offlineChapterService';
import { offlineChapterVersionService } from '../../../services/offlineChapterVersionService';
import type { ChapterVersionResponse } from '../../../types/chapterVersion';
import { useParentItem, useVersionCompare } from '../../../hooks/versions/useVersionCompare';
import {
  FeedbackBanner,
  MergeOptions,
  VersionsError,
  VersionsFilterBar,
  VersionsHeader,
  VersionsLoading,
} from '../../../components/versions/VersionParts';
import { VersionList } from '../../../components/versions/VersionList';
import { ComparePanel, CompareCards } from '../../../components/versions/ComparePanel';
import { LineDiffView } from '../../../components/versions/LineDiffView';

const MERGE_FIELDS = [
  { key: 'title', label: 'Titre' },
  { key: 'content', label: 'Contenu' },
] as const;

const getContent = (version: ChapterVersionResponse) => version.content ?? '';

const renderHtml = (body: string) => <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body || '') }} />;

const BODY_CLASS =
  'max-h-64 md:max-h-96 overflow-y-auto prose prose-invert max-w-none wrap-break-word text-amber-100/90 font-serif text-sm sm:text-base [&_img]:max-w-full';

export function ChapterVersionsPage() {
  const { bookId, chapterId, versionId } = useParams<{ bookId: string; chapterId: string; versionId?: string }>();
  const navigate = useNavigate();

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
  });

  const [mergeFields, setMergeFields] = useState({ title: true, content: true });
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  const [hideEqualLines, setHideEqualLines] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
    if (!confirm(`Supprimer la version ${version.versionNumber} ?`)) return;

    const success = await offlineChapterVersionService.remove(version.id);
    if (success) {
      setFeedback(`Version ${version.versionNumber} supprimée.`);
      await refetch();
      return;
    }
    setFeedback('Impossible de supprimer cette version.');
  };

  if (isLoading || chapterLoading) return <VersionsLoading />;
  if (error || !chapter) return <VersionsError message={error ?? 'Ce chapitre n’existe plus ou est introuvable.'} />;

  const { versionToCompare } = compare;

  const displayRows = hideEqualLines 
    ? compare.rows.filter(row => row.kind !== 'equal') 
    : compare.rows;

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
        >
        </VersionsFilterBar>

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
            <ComparePanel
              mode={compare.compareMode}
              onModeChange={compare.setCompareMode}
              currentLeftLabel="Actuel à gauche"
            >
              <CompareCards
                mode={compare.compareMode}
                current={{ label: 'Chapitre actuel', name: chapter.title, body: chapter.content ?? '' }}
                version={{ label: 'Version sélectionnée', name: versionToCompare.name, body: versionToCompare.content ?? '' }}
                renderBody={renderHtml}
                bodyClassName={BODY_CLASS}
              />

              <div className="border-t border-amber-900/30 pt-6 mt-2 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4 font-sans">
                  <div className="flex p-1 bg-neutral-950/50 rounded-lg border border-amber-900/30">
                    <button
                      onClick={() => setShowPreview(false)}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${!showPreview ? 'bg-amber-700 text-amber-50 shadow-sm' : 'text-amber-200/70 hover:text-amber-200'}`}
                    >
                      Comparatif par ligne
                    </button>
                    <button
                      onClick={() => setShowPreview(true)}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${showPreview ? 'bg-amber-700 text-amber-50 shadow-sm' : 'text-amber-200/70 hover:text-amber-200'}`}
                    >
                      Aperçu de la fusion
                    </button>
                  </div>

                  {!showPreview && (
                    <label className="flex items-center gap-2 text-sm text-amber-200/80 cursor-pointer hover:text-amber-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={hideEqualLines}
                        onChange={(e) => setHideEqualLines(e.target.checked)}
                        className="rounded border-amber-900/50 bg-neutral-900 text-amber-600 focus:ring-amber-600/50 w-4 h-4 cursor-pointer"
                      />
                      Masquer les lignes identiques
                    </label>
                  )}
                </div>

                {showPreview ? (
                  <div className="p-5 rounded-xl border border-amber-900/30 bg-neutral-900/40">
                    <h4 className="text-xs font-sans font-semibold text-amber-200/50 uppercase tracking-widest mb-4">
                      Rendu final du contenu
                    </h4>
                    <div className={BODY_CLASS}>
                      {renderHtml(compare.mergeFor(versionToCompare))}
                    </div>
                  </div>
                ) : (
                  <LineDiffView
                    rows={displayRows}
                    choices={compare.choices}
                    onChoose={compare.choose}
                    help="Chaque bloc différent peut être gardé depuis le chapitre actuel ou la version."
                    emptyMessage={hideEqualLines ? "Aucune différence trouvée (toutes les lignes identiques sont masquées)." : "Aucune ligne de contenu à comparer."}
                  />
                )}
              </div>

              <MergeOptions
                fields={MERGE_FIELDS}
                value={mergeFields}
                onChange={setMergeFields}
                onMerge={() => handleMerge(versionToCompare)}
                isRestoring={isRestoring}
              />
            </ComparePanel>
          )}
        </div>
      </main>
    </div>
  );
}

export default ChapterVersionsPage;