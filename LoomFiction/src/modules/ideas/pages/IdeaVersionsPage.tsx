import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIdeaVersions } from '../hooks/useIdeaVersions';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineIdeaVersionService } from '../../../services/offlineIdeaVersionService';
import type { IdeaVersionResponse } from '../../../types/ideaVersion';
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
  { key: 'name', label: 'Nom' },
  { key: 'description', label: 'Description' },
] as const;

const getDescription = (version: IdeaVersionResponse) => version.description ?? '';

const renderText = (body: string) => body || 'Aucune description.';

const BODY_CLASS =
  'max-h-56 md:max-h-72 overflow-y-auto text-sm sm:text-base text-amber-100/90 font-serif whitespace-pre-wrap wrap-break-word leading-relaxed';

export function IdeaVersionsPage() {
  const { ideaId, versionId } = useParams<{ ideaId: string; versionId?: string }>();
  const navigate = useNavigate();

  const numIdeaId = ideaId ? Number(ideaId) : null;
  const numVersionId = versionId ? Number(versionId) : null;

  const { versions, selectedVersion, isLoading, error, refetch } = useIdeaVersions(numIdeaId, numVersionId);

  const { item: idea, loading: ideaLoading } = useParentItem(numIdeaId, offlineIdeaService.getById);

  const compare = useVersionCompare({
    versions,
    selectedVersion,
    currentText: idea?.description || '',
    getText: getDescription,
  });

  const [mergeFields, setMergeFields] = useState({ name: true, description: true });
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState('');

  const [hideEqualLines, setHideEqualLines] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
    if (!confirm(`Supprimer la version ${version.versionNumber} ?`)) return;

    const success = await offlineIdeaVersionService.remove(version.id);
    if (success) {
      setFeedback(`Version ${version.versionNumber} supprimée.`);
      await refetch();
      return;
    }
    setFeedback('Impossible de supprimer cette version.');
  };

  if (isLoading || ideaLoading) return <VersionsLoading />;
  if (error || !idea) return <VersionsError message={error ?? 'Cette idée n’existe plus ou est introuvable.'} />;

  const { versionToCompare } = compare;

  const displayRows = hideEqualLines 
    ? compare.rows.filter(row => row.kind !== 'equal') 
    : compare.rows;

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#1c1411] text-[#fcf9f2] font-serif">
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
            isRestoring={isRestoring}
            onView={(version) => navigate(`/ideas/${numIdeaId}/versions/${version.id}`)}
            onMerge={handleMerge}
            onDelete={handleDelete}
          />

          {versionToCompare && (
            <ComparePanel
              mode={compare.compareMode}
              onModeChange={compare.setCompareMode}
              currentLeftLabel="Actuelle à gauche"
            >
              <CompareCards
                mode={compare.compareMode}
                current={{ label: 'Idée actuelle', name: idea.name, body: idea.description ?? '' }}
                version={{ label: 'Version sélectionnée', name: versionToCompare.name, body: versionToCompare.description ?? '' }}
                renderBody={renderText}
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
                      Rendu final de la description
                    </h4>
                    <div className={BODY_CLASS}>
                      {renderText(compare.mergeFor(versionToCompare))}
                    </div>
                  </div>
                ) : (
                  <LineDiffView
                    rows={displayRows}
                    choices={compare.choices}
                    onChoose={compare.choose}
                    help="Choisis pour chaque ligne modifiée celle à conserver."
                    emptyMessage={hideEqualLines ? "Aucune différence trouvée (toutes les lignes identiques sont masquées)." : "Aucune ligne de description à comparer."}
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

export default IdeaVersionsPage;