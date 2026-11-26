import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIdeaVersions } from '../hooks/useIdeaVersions';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineIdeaVersionService } from '../../../services/offlineIdeaVersionService';
import type { IdeaVersionResponse } from '../../../types/ideaVersion';
import { useParentItem, useVersionCompare } from '../../../hooks/versions/useVersionCompare';
import { htmlToText } from '../../../utils/versions/htmlText';
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
import { useConfirm } from '../../../components/feedback/FeedbackProvider';
import { IconClose } from '../../../components/icons';

import { ExplorerBridge } from '../../../hooks/explorerBridge';
import { DiffView } from '../../../components/diff/DiffView';
import { changeIdsOf, diffLines } from '../../../components/diff/diffRows';

const MERGE_FIELDS = [
  { key: 'name', label: 'Nom' },
  { key: 'description', label: 'Description' },
] as const;

const getDescription = (version: IdeaVersionResponse) => version.description ?? '';

export function IdeaVersionsPage() {
  const { ideaId, versionId } = useParams<{ ideaId: string; versionId?: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const numIdeaId = ideaId ? Number(ideaId) : null;
  const numVersionId = versionId ? Number(versionId) : null;

  const { versions, selectedVersion, isLoading, error, refetch } = useIdeaVersions(numIdeaId, numVersionId);
  const { item: idea, loading: ideaLoading } = useParentItem(numIdeaId, offlineIdeaService.getById);

  const compare = useVersionCompare({
    versions,
    selectedVersion,
    currentText: idea?.description || '',
    getText: getDescription,
    richText: true,
  });

  const [mergeFields, setMergeFields] = useState({ name: true, description: true });
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!isLoading && !ideaLoading && (error || !idea)) {
      navigate('/404', { replace: true });
    }
  }, [isLoading, ideaLoading, error, idea, navigate]);

  const handleSnapshot = async () => {
    if (!numIdeaId || !idea) return;

    try {
      const versionNumber = await offlineIdeaVersionService.nextVersionNumber(numIdeaId);
      await offlineIdeaVersionService.create({
        ideaId: numIdeaId,
        versionNumber,
        name: idea.name,
        description: idea.description,
      });
      setFeedback(`Version ${versionNumber} créée.`);
      await refetch();
    } catch (createError) {
      console.error('Erreur lors de la création de version idée :', createError);
      setFeedback('Impossible de créer cette version.');
    }
  };

  const handleMerge = async (version: IdeaVersionResponse) => {
    if (!numIdeaId || !idea) return;

    setIsRestoring(true);
    try {
      await offlineIdeaService.update(numIdeaId, {
        name: mergeFields.name ? version.name : idea.name,
        description: mergeFields.description ? compare.mergeFor(version) : idea.description,
        bookId: idea.bookId,
        categoryId: idea.categoryId,
        status: idea.status,
      });
      setFeedback('Fusion appliquée à l’idée courante.');
      navigate('/ideas');
    } catch (restoreError) {
      console.error('Erreur lors de la restauration de la version idée :', restoreError);
      setFeedback('Impossible de restaurer cette version.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (version: IdeaVersionResponse) => {
    const ok = await confirm({
      title: `Supprimer la version ${version.versionNumber} ?`,
      message: 'Cette action est irréversible.',
      tone: 'danger',
    });
    if (!ok) return;

    const success = await offlineIdeaVersionService.remove(version.id);
    if (success) {
      setFeedback(`Version ${version.versionNumber} supprimée.`);
      await refetch();
      return;
    }
    setFeedback('Impossible de supprimer cette version.');
  };

  const diffRows = useMemo(() => {
    if (!compare.versionToCompare || !idea) return [];
    const toLines = (html: string) => htmlToText(html).split('\n');
    return diffLines(toLines(compare.versionToCompare.description || ''), toLines(idea.description || ''));
  }, [compare.versionToCompare, idea]);
  const changeIds = useMemo(() => changeIdsOf(diffRows), [diffRows]);

  if (isLoading || ideaLoading) return <VersionsLoading />;
  if (error || !idea) return <VersionsError message={error ?? 'Cette idée n’existe plus ou est introuvable.'} />;

  const { versionToCompare } = compare;

  return (
    <div className="loom relative flex min-h-[calc(100dvh-var(--nav-top,0px)-var(--nav-bottom,0px))] items-start bg-[var(--c-page)] font-serif text-[var(--c-ink)]">
      {/* Dit à l'explorateur commun quelle version est affichée (sinon il ne retient que l'adresse). */}
      <ExplorerBridge section="versions" value={{ selectedVersionId: versionToCompare?.id ?? null }} />

      <div className="min-w-0 flex-1 self-stretch">
      <VersionsHeader
        title="Versions de l’idée"
        subtitle={idea.name}
        backLabel="Retour au carnet"
        openLabel="Ouvrir le carnet"
        onBack={() => navigate('/ideas')}
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
          actionsClassName="flex justify-end"
        >
          <ToolbarButton accent onClick={handleSnapshot}>Snapshot</ToolbarButton>
        </VersionsFilterBar>

        <div className="flex flex-col gap-4 sm:gap-6">
          <VersionList
            versions={compare.visibleVersions}
            selectedId={selectedVersion?.id ?? null}
            onView={(version) => navigate(`/ideas/${numIdeaId}/versions/${version.id}`)}
            onDelete={handleDelete}
          />

          {versionToCompare && (
            <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/70 p-3 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-200/40 mb-1">Comparaison visuelle</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-amber-100">
                    v{versionToCompare.versionNumber} {versionToCompare.name ? `- ${versionToCompare.name}` : ''} vs Idée Actuelle
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/ideas')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-amber-900/30 rounded-lg text-xs font-sans text-amber-200 hover:bg-neutral-800 transition-colors"
                >
                  <IconClose className="size-3.5" />
                  Fermer
                </button>
              </div>

              {/* Comparaison en lecture seule : l’ancienne version à gauche, l’idée actuelle à droite */}
              <DiffView
                embedded
                className="h-[22rem] sm:h-[26rem]"
                rows={diffRows}
                changeIds={changeIds}
                oldLabel={`v${versionToCompare.versionNumber}${versionToCompare.name ? ` - ${versionToCompare.name}` : ''}`}
                currentLabel="Idée actuelle"
              />

              <MergeOptions
                fields={MERGE_FIELDS}
                value={mergeFields}
                onChange={setMergeFields}
                onMerge={() => handleMerge(versionToCompare)}
                isRestoring={isRestoring}
                actionLabel={`Appliquer la v${versionToCompare.versionNumber} à l’idée`}
              />
            </section>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

export default IdeaVersionsPage;