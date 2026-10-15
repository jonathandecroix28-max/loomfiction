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
  ToolbarButton,
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

  // Le chapitre se charge en parallèle des versions : on suit les deux chargements,
  // sinon la page redirige vers /404 avant que le chapitre soit arrivé.
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
          <ToolbarButton onClick={() => setMergeFields({ title: true, content: true })}>Tout reprendre</ToolbarButton>
          <ToolbarButton onClick={() => setMergeFields({ title: false, content: false })}>Garder l’éditeur</ToolbarButton>
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
              <LineDiffView
                rows={compare.rows}
                choices={compare.choices}
                onChoose={compare.choose}
                help="Chaque bloc différent peut être gardé depuis le chapitre actuel ou la version."
                emptyMessage="Aucune ligne de contenu à comparer."
              />
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