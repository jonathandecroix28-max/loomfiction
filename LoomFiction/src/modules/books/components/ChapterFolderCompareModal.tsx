import { useState } from 'react';
import type { ChapterVersionResponse } from '../../../types/chapterVersion';
import type { ChapterResponse } from '../../../types/chapter';
import { IconCompare } from '../../../components/icons';
import { useToast } from '../../../components/feedback/FeedbackProvider';
import { offlineChapterService } from '../../../services/offlineChapterService';
import { useVersionCompare } from '../../../hooks/versions/useVersionCompare';
import { ComparePanel, CompareCards } from '../../../components/versions/ComparePanel';
import { LineDiffView } from '../../../components/versions/LineDiffView';
import { MergeOptions } from '../../../components/versions/VersionParts';
import { htmlToPlainText } from '../../../utils/versions/sanitizeHtml';
import type { SelectableVersionItem } from '../utils/bookDetailTypes';

const MERGE_FIELDS = [
  { key: 'title', label: 'Titre' },
  { key: 'content', label: 'Contenu' },
] as const;

const getContent = (version: ChapterVersionResponse) => version.content ?? '';
const renderPlain = (body: string) => htmlToPlainText(body) || 'Aucun contenu.';
const BODY_CLASS =
  'max-h-72 md:max-h-96 overflow-y-auto max-w-none whitespace-pre-wrap leading-relaxed wrap-break-word text-amber-100/90 font-serif text-sm sm:text-base';

export function ChapterFolderCompareModal({
  chapter,
  itemA,
  itemB,
  onClose,
  onMerged,
}: {
  chapter: ChapterResponse;
  itemA: SelectableVersionItem;
  itemB: SelectableVersionItem;
  onClose: () => void;
  onMerged: (chapters: ChapterResponse[]) => Promise<void>;
}) {
  const toast = useToast();
  const [mergeFields, setMergeFields] = useState({ title: true, content: true });
  const [isRestoring, setIsRestoring] = useState(false);
  const [hideEqualLines, setHideEqualLines] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const leftContent = itemA.kind === 'current' ? itemA.content : itemA.raw.content ?? '';
  const leftTitle = itemA.kind === 'current' ? itemA.name : itemA.raw.name;

  const targetVersion: ChapterVersionResponse =
    itemB.kind === 'archive'
      ? itemB.raw
      : {
          id: -1,
          chapterId: chapter.id,
          versionNumber: 0,
          name: itemB.name,
          content: itemB.content,
          updatedAt: itemB.updatedAt,
          createdAt: itemB.createdAt,
        };

  const compare = useVersionCompare({
    versions: [targetVersion],
    selectedVersion: targetVersion,
    currentText: leftContent,
    getText: getContent,
    richText: true,
  });

  const displayRows = hideEqualLines
    ? compare.rows.filter((row) => row.kind !== 'equal')
    : compare.rows;

  const handleApplyMerge = async () => {
    setIsRestoring(true);
    try {
      const mergedContent = mergeFields.content ? compare.mergeFor(targetVersion) : chapter.content;
      const mergedTitle = mergeFields.title ? targetVersion.name || chapter.title : chapter.title;

      await offlineChapterService.update(chapter.id, mergedTitle, mergedContent);
      const refreshedChapters = await offlineChapterService.getByBookId(Number(chapter.book_id));
      toast.success('Fusion appliquée au chapitre.');
      await onMerged(refreshedChapters);
    } catch (err) {
      console.error('Erreur lors de la fusion :', err);
      toast.error('Impossible d’appliquer la fusion.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-[#1c1411] border border-amber-700/40 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-amber-900/30 flex flex-wrap items-center justify-between gap-4 bg-neutral-950/90">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
              Comparateur & Fusion · {chapter.title}
            </span>
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-amber-100 mt-0.5">
              {itemA.label} <IconCompare className="mx-1 inline size-4 text-amber-500" aria-hidden="true" /> {itemB.label}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="bg-neutral-900 hover:bg-neutral-800 text-amber-200 px-4 py-2 rounded-xl text-sm border border-amber-900/30 cursor-pointer"
          >
            Fermer
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          <ComparePanel
            mode={compare.compareMode}
            onModeChange={compare.setCompareMode}
            currentLeftLabel={`${itemA.label} à gauche`}
          >
            <CompareCards
              mode={compare.compareMode}
              current={{ label: itemA.label, name: leftTitle, body: leftContent }}
              version={{ label: itemB.label, name: targetVersion.name, body: targetVersion.content ?? '' }}
              renderBody={renderPlain}
              bodyClassName={BODY_CLASS}
            />

            <div className="border-t border-amber-900/30 pt-6 mt-2 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4 font-sans">
                <div className="flex p-1 bg-neutral-950/50 rounded-lg border border-amber-900/30 w-full sm:w-auto">
                  <button
                    onClick={() => setShowPreview(false)}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer ${
                      !showPreview
                        ? 'bg-amber-700 text-amber-50 shadow-sm'
                        : 'text-amber-200/70 hover:text-amber-200'
                    }`}
                  >
                    Ligne par ligne
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer ${
                      showPreview
                        ? 'bg-amber-700 text-amber-50 shadow-sm'
                        : 'text-amber-200/70 hover:text-amber-200'
                    }`}
                  >
                    Aperçu final
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
                    Rendu final du contenu fusionné
                  </h4>
                  <div className={BODY_CLASS}>{renderPlain(compare.mergeFor(targetVersion))}</div>
                </div>
              ) : (
                <LineDiffView
                  rows={displayRows}
                  choices={compare.choices}
                  onChoose={compare.choose}
                  help="Chaque bloc différent peut être conservé depuis la version de gauche ou celle de droite."
                  emptyMessage={
                    hideEqualLines
                      ? 'Aucune différence trouvée (toutes les lignes identiques sont masquées).'
                      : 'Aucune ligne de contenu à comparer.'
                  }
                />
              )}
            </div>

            <MergeOptions
              fields={MERGE_FIELDS}
              value={mergeFields}
              onChange={setMergeFields}
              onMerge={handleApplyMerge}
              isRestoring={isRestoring}
            />
          </ComparePanel>
        </div>
      </div>
    </div>
  );
}