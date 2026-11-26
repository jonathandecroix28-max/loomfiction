import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSheetPage } from '../hooks/useSheetPage';
import { useSheetVersions } from '../hooks/useSheetVersions';
import { useCreateIdea } from '../../ideas/hooks/useCreateIdea';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineSheetVersionService } from '../../../services/offlineSheetVersionService';
import { useVersionCompare } from '../../../hooks/versions/useVersionCompare';
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
import { toUpsert } from '../sheetLinks';
import type { IdeaResponse } from '../../../types/idea';
import type { SheetSnapshotCard, SheetVersion } from '../../../types/sheetVersion';
import { IconClose } from '../../../components/icons';
import { wordDiff, type Seg } from '../../../components/diff/diffRows';
import '../../../components/diff/diff.css';

import { ExplorerBridge } from '../../../hooks/explorerBridge';

const MERGE_FIELDS = [
  { key: 'name', label: 'Nom de la fiche' },
  { key: 'cards', label: 'Cartes' },
] as const;

type CardStatus = 'same' | 'changed' | 'added' | 'removed';
type Choice = 'current' | 'version';

interface CardRow {
  key: string;
  status: CardStatus;
  current: IdeaResponse | null;
  snap: SheetSnapshotCard | null;
}

const STATUS_LABEL: Record<CardStatus, string> = {
  same: 'Identique',
  changed: 'Modifiée',
  added: 'Supprimée depuis',
  removed: 'Ajoutée depuis',
};

const STATUS_PILL: Record<CardStatus, string> = {
  same: 'ld-pill-eq',
  changed: 'ld-pill-mod',
  added: 'ld-pill-del',
  removed: 'ld-pill-add',
};

const SHEET_TONE: Record<CardStatus, string> = {
  same: 'ld-sheet-eq',
  changed: 'ld-sheet-neutral',
  added: 'ld-sheet-del',
  removed: 'ld-sheet-add',
};

function renderSegs(segs: Seg[] | undefined, fallback: string) {
  if (!segs) return fallback;
  return segs.map((seg, index) =>
    seg.changed ? (
      <span key={index} className="ld-w">
        {seg.text}
      </span>
    ) : (
      seg.text
    ),
  );
}

const CHOICE_LABELS: Record<Exclude<CardStatus, 'same'>, { current: string; version: string }> = {
  changed: { current: 'Garder l’actuelle', version: 'Prendre la version' },
  added: { current: 'Laisser supprimée', version: 'Restaurer la carte' },
  removed: { current: 'Garder la carte', version: 'Retirer de la fiche' },
};

const norm = (text?: string | null) => htmlToText(text).trimEnd();
const plain = (text?: string | null) => htmlToText(text).trim();
const bySort = (a: { sortOrder?: number }, b: { sortOrder?: number }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

function buildRows(cards: IdeaResponse[], version: SheetVersion): CardRow[] {
  const snaps = [...version.cards].sort(bySort);
  const rows: CardRow[] = [];
  const matched = new Set<number>();

  for (const current of [...cards].sort(bySort)) {
    const snap = snaps.find((item) => item.id === current.id) ?? null;
    if (!snap) {
      rows.push({ key: `now-${current.id}`, status: 'removed', current, snap: null });
      continue;
    }

    matched.add(snap.id);
    const same =
      current.name.trim() === snap.name.trim() &&
      norm(current.description) === norm(snap.description) &&
      (current.status ?? 'draft') === (snap.status ?? 'draft');
    rows.push({ key: `card-${current.id}`, status: same ? 'same' : 'changed', current, snap });
  }

  for (const snap of snaps) {
    if (!matched.has(snap.id)) rows.push({ key: `old-${snap.id}`, status: 'added', current: null, snap });
  }

  return rows;
}

interface ResultCard {
  key: string;
  name: string;
  description: string;
  tag: string | null;
}

export function SheetVersionsPage() {
  const { sheetId, versionId } = useParams<{ sheetId: string; versionId?: string }>();
  const navigate = useNavigate();

  const numSheetId = sheetId ? Number(sheetId) : null;
  const numVersionId = versionId ? Number(versionId) : null;
  const sheetPath = `/ideas/fiches/${numSheetId}`;
  const versionsPath = `${sheetPath}/versions`;

  const { sheet, cards, isLoading: sheetLoading, error: sheetError } = useSheetPage(numSheetId);
  const { versions, selectedVersion, isLoading, error, refetch } = useSheetVersions(numSheetId, numVersionId);
  const { createIdea } = useCreateIdea();

  const compare = useVersionCompare({
    versions,
    selectedVersion,
    currentText: '',
    getText: () => '',
  });

  const [mergeFields, setMergeFields] = useState({ name: true, cards: true });
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [hideSame, setHideSame] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState('');

  const versionToCompare = compare.versionToCompare as SheetVersion | null;

  useEffect(() => {
    if (!isLoading && !sheetLoading && (error || sheetError || !sheet)) {
      navigate('/404', { replace: true });
    }
  }, [isLoading, sheetLoading, error, sheetError, sheet, navigate]);

  const [prevVersionId, setPrevVersionId] = useState(versionToCompare?.id);
  if (versionToCompare?.id !== prevVersionId) {
    setPrevVersionId(versionToCompare?.id);
    setChoices({});
  }

  const rows = useMemo(() => (versionToCompare ? buildRows(cards, versionToCompare) : []), [cards, versionToCompare]);
  const choiceOf = (row: CardRow): Choice => choices[row.key] ?? 'current';

  const counts = useMemo(() => {
    const resultCount: Record<CardStatus, number> = { same: 0, changed: 0, added: 0, removed: 0 };
    rows.forEach((row) => {
      resultCount[row.status] += 1;
    });
    return resultCount;
  }, [rows]);

  const differences = counts.changed + counts.added + counts.removed;
  const visibleRows = hideSame ? rows.filter((row) => row.status !== 'same') : rows;

  const wordDiffs = useMemo(() => {
    const map = new Map<string, { name: Seg[] | undefined; description: Seg[] | undefined; nameNew: Seg[] | undefined; descriptionNew: Seg[] | undefined }>();
    for (const row of rows) {
      if (row.status !== 'changed' || !row.snap || !row.current) continue;
      const name = wordDiff(row.snap.name, row.current.name);
      const description = wordDiff(plain(row.snap.description), plain(row.current.description));
      map.set(row.key, {
        name: name?.left,
        nameNew: name?.right,
        description: description && description.ratio >= 0.2 ? description.left : undefined,
        descriptionNew: description && description.ratio >= 0.2 ? description.right : undefined,
      });
    }
    return map;
  }, [rows]);

  const taken = useMemo(() => {
    const total = { changed: 0, added: 0, removed: 0 };
    rows.forEach((row) => {
      if (row.status !== 'same' && (choices[row.key] ?? 'current') === 'version') total[row.status] += 1;
    });
    return total;
  }, [rows, choices]);

  const applyAll = (choice: Choice) => {
    const next: Record<string, Choice> = {};
    rows.forEach((row) => {
      if (row.status !== 'same') next[row.key] = choice;
    });
    setChoices(next);
  };

  const result = useMemo<{ name: string; cards: ResultCard[] }>(() => {
    if (!sheet || !versionToCompare) return { name: '', cards: [] };

    const resultCards: ResultCard[] = [];
    const restored: ResultCard[] = [];

    for (const row of rows) {
      const take = mergeFields.cards && (choices[row.key] ?? 'current') === 'version';

      if (row.current) {
        if (row.status === 'removed' && take) continue;
        if (row.status === 'changed' && take && row.snap) {
          resultCards.push({ key: row.key, name: row.snap.name, description: row.snap.description, tag: 'Version' });
        } else {
          resultCards.push({ key: row.key, name: row.current.name, description: row.current.description ?? '', tag: null });
        }
      } else if (row.snap && take) {
        restored.push({ key: row.key, name: row.snap.name, description: row.snap.description, tag: 'Restaurée' });
      }
    }

    return {
      name: mergeFields.name ? versionToCompare.name : sheet.name,
      cards: [...resultCards, ...restored],
    };
  }, [rows, choices, mergeFields, sheet, versionToCompare]);

  const handleSnapshot = async () => {
    if (!sheet) return;
    try {
      const version = await offlineSheetVersionService.createFromSheet(sheet, cards);
      setFeedback(`Version ${version.versionNumber} créée.`);
      await refetch();
    } catch (createError) {
      console.error('Erreur lors de la création de version de fiche :', createError);
      setFeedback('Impossible de créer cette version.');
    }
  };

  const handleMerge = async () => {
    if (!sheet || !versionToCompare) return;

    setIsRestoring(true);
    try {
      if (mergeFields.name && result.name !== sheet.name) {
        await offlineSheetService.update(sheet.id, { name: result.name });
      }

      if (mergeFields.cards) {
        let order = cards.reduce((max, card) => Math.max(max, card.sortOrder ?? 0), -1) + 1;

        for (const row of rows) {
          if (choiceOf(row) !== 'version') continue;

          if (row.status === 'changed' && row.current && row.snap) {
            await offlineIdeaService.update(row.current.id, {
              ...toUpsert(row.current),
              name: row.snap.name,
              description: row.snap.description,
              status: row.snap.status ?? row.current.status,
            });
          } else if (row.status === 'removed' && row.current) {
            await offlineIdeaService.remove(row.current.id);
          } else if (row.status === 'added' && row.snap) {
            const created = await createIdea({
              name: row.snap.name,
              description: row.snap.description,
              bookId: row.snap.bookId,
              categoryId: sheet.categoryId,
              status: row.snap.status ?? 'draft',
              sheetId: sheet.id,
              sortOrder: order,
            });
            if (!created) throw new Error('Impossible de restaurer une carte.');
            order += 1;
          }
        }
      }

      navigate(sheetPath);
    } catch (restoreError) {
      console.error('Erreur lors de la restauration de la version de fiche :', restoreError);
      setFeedback('Impossible de restaurer cette version.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (version: SheetVersion) => {
    if (!confirm(`Supprimer la version ${version.versionNumber} ?`)) return;

    const success = await offlineSheetVersionService.remove(version.id);
    if (success) {
      setFeedback(`Version ${version.versionNumber} supprimée.`);
      await refetch();
      return;
    }
    setFeedback('Impossible de supprimer cette version.');
  };

  if (isLoading || sheetLoading) return <VersionsLoading />;
  if (error || sheetError || !sheet) return <VersionsError message={error ?? 'Cette fiche n’existe plus ou est introuvable.'} />;

  const renamed = mergeFields.name && !!versionToCompare && versionToCompare.name !== sheet.name;
  const cardsTouched = mergeFields.cards ? taken.changed + taken.added + taken.removed : 0;
  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  const summaryParts: string[] = [];
  if (renamed && versionToCompare) summaryParts.push(`la fiche sera renommée « ${versionToCompare.name} »`);
  if (mergeFields.cards && taken.changed) summaryParts.push(`${plural(taken.changed, 'carte remplacée', 'cartes remplacées')} par la version`);
  if (mergeFields.cards && taken.added) summaryParts.push(`${plural(taken.added, 'carte restaurée', 'cartes restaurées')}`);
  if (mergeFields.cards && taken.removed) summaryParts.push(`${plural(taken.removed, 'carte retirée', 'cartes retirées')}`);
  const mergeSummary = summaryParts.length
    ? `Ce qui va se passer : ${summaryParts.join(' · ')}.`
    : 'Rien ne sera modifié : tout l’actuel est conservé. Choisis « Prendre la version » sur une carte pour la changer.';

  return (
    <div className="loom relative flex min-h-[calc(100dvh-var(--nav-top,0px)-var(--nav-bottom,0px))] items-start bg-[var(--c-page)] font-serif text-[var(--c-ink)]">
      {/* Dit à l'explorateur commun quelle version est affichée (sinon il ne retient que l'adresse). */}
      <ExplorerBridge section="versions" value={{ selectedVersionId: versionToCompare?.id ?? null }} />

      <div className="min-w-0 flex-1 self-stretch">
      <VersionsHeader
        title="Versions de la fiche"
        subtitle={sheet.name}
        backLabel="Retour à la fiche"
        openLabel="Ouvrir la fiche"
        onBack={() => navigate(sheetPath)}
        versionsCount={versions.length}
        selectedNumber={versionToCompare?.versionNumber ?? null}
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
          <ToolbarButton accent onClick={handleSnapshot}>
            Enregistrer une version
          </ToolbarButton>
        </VersionsFilterBar>

        <div className="flex flex-col gap-4 sm:gap-6">
          <VersionList
            versions={compare.visibleVersions}
            selectedId={versionToCompare?.id ?? null}
            onView={(version) => navigate(`${versionsPath}/${version.id}`)}
            onDelete={handleDelete}
          />

          {versionToCompare && (
            <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/70 p-3 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-200/40 mb-1">Comparaison visuelle</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-amber-100">
                    v{versionToCompare.versionNumber} {versionToCompare.name ? `- ${versionToCompare.name}` : ''} vs Fiche Actuelle
                  </h2>
                </div>
                <button
                  onClick={() => navigate(sheetPath)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-amber-900/30 rounded-lg text-xs font-sans text-amber-200 hover:bg-neutral-800 transition-colors"
                >
                  <IconClose className="size-3.5" />
                  Fermer
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 font-sans pt-2">
                <p className="text-xs sm:text-sm text-amber-200/60">
                  {differences === 0
                    ? 'La version est identique à la fiche actuelle.'
                    : `${counts.changed} modifiée(s) · ${counts.added} supprimée(s) depuis · ${counts.removed} ajoutée(s) depuis · ${counts.same} identique(s)`}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-amber-200/80">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={hideSame}
                      onChange={(e) => setHideSame(e.target.checked)}
                    />
                    <span className="ld-switch" aria-hidden="true" />
                    Masquer les identiques
                  </label>
                  {differences > 0 && (
                    <div className="ld-seg w-full sm:w-auto">
                      <button type="button" onClick={() => applyAll('current')} className="flex-1">
                        Tout garder l’actuel
                      </button>
                      <button type="button" onClick={() => applyAll('version')} className="flex-1">
                        Tout prendre de la version
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {visibleRows.length === 0 ? (
                <div className="px-4 py-6 text-center text-amber-200/50 text-sm border border-amber-900/20 rounded-xl bg-neutral-950/60">
                  {rows.length === 0 ? 'Aucune carte à comparer.' : 'Aucune différence : toutes les cartes sont identiques.'}
                </div>
              ) : (
                <ul className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                  {visibleRows.map((row) => {
                    const title = (row.current ?? row.snap)?.name ?? '';
                    const choice = choiceOf(row);
                    const words = wordDiffs.get(row.key);
                    const pick = (value: Choice) => (row.status === 'same' ? undefined : choice === value ? 'kept' : 'dropped');
                    return (
                      <li key={row.key} className={`ld-sheet overflow-hidden ${SHEET_TONE[row.status]}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/20 px-4 py-2.5 font-sans">
                          <span className="min-w-0 truncate font-serif text-base font-semibold text-amber-100">{title}</span>
                          <span className={`ld-pill ${STATUS_PILL[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                        </div>

                        {row.status === 'same' ? (
                          <p className="whitespace-pre-wrap px-4 py-3 font-serif text-sm text-amber-100/70">
                            {plain(row.current?.description) || <span className="italic text-amber-200/30">(vide)</span>}
                          </p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 divide-y divide-amber-900/20 md:grid-cols-2 md:divide-x md:divide-y-0">
                              <div className="ld-side ld-side-del" data-pick={pick('version')}>
                                <div className="ld-side-label">Version v{versionToCompare.versionNumber}</div>
                                <div className="whitespace-pre-wrap font-serif text-sm text-amber-100/90">
                                  {row.snap ? (
                                    <>
                                      <div className="font-bold">{renderSegs(words?.name, row.snap.name)}</div>
                                      <div className="mt-1">
                                        {renderSegs(words?.description, plain(row.snap.description)) || '(vide)'}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="italic text-amber-200/40">absente</span>
                                  )}
                                </div>
                              </div>

                              <div className="ld-side ld-side-add" data-pick={pick('current')}>
                                <div className="ld-side-label">Fiche actuelle</div>
                                <div className="whitespace-pre-wrap font-serif text-sm text-amber-100/90">
                                  {row.current ? (
                                    <>
                                      <div className="font-bold">{renderSegs(words?.nameNew, row.current.name)}</div>
                                      <div className="mt-1">
                                        {renderSegs(words?.descriptionNew, plain(row.current.description)) || '(vide)'}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="italic text-amber-200/40">absente</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 border-t border-amber-900/20 px-4 py-3 font-sans">
                              <span className="text-xs text-amber-200/60">Que garder pour cette carte ?</span>
                              <div className="ld-seg w-full sm:w-auto" role="group" aria-label={`Choix pour ${title}`}>
                                {(['current', 'version'] as const).map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setChoices((current) => ({ ...current, [row.key]: value }))}
                                    aria-pressed={choice === value}
                                    className="flex-1 sm:flex-none"
                                  >
                                    {CHOICE_LABELS[row.status as Exclude<CardStatus, 'same'>][value]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <MergeOptions
                fields={MERGE_FIELDS}
                value={mergeFields}
                onChange={setMergeFields}
                onMerge={() => void handleMerge()}
                isRestoring={isRestoring}
                actionLabel="Appliquer mes choix à la fiche"
                summary={mergeSummary}
                disabled={!renamed && cardsTouched === 0}
              />
            </section>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

export default SheetVersionsPage;