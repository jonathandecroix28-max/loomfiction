import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSheetPage } from '../hooks/useSheetPage';
import { useSheetVersions } from '../hooks/useSheetVersions';
import { useCreateIdea } from '../../ideas/hooks/useCreateIdea';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineSheetVersionService } from '../../../services/offlineSheetVersionService';
import { useVersionCompare } from '../../../hooks/versions/useVersionCompare';
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

const STATUS_STYLE: Record<CardStatus, string> = {
  same: 'border-emerald-900/30 bg-emerald-950/30 text-emerald-300',
  changed: 'border-amber-800/40 bg-amber-950 text-amber-300',
  added: 'border-blue-800/40 bg-blue-950/60 text-blue-300',
  removed: 'border-red-900/40 bg-red-950/40 text-red-300',
};

/** Libellés des deux choix selon le cas. */
const CHOICE_LABELS: Record<Exclude<CardStatus, 'same'>, { current: string; version: string }> = {
  changed: { current: 'Garder l’actuelle', version: 'Prendre la version' },
  added: { current: 'Laisser supprimée', version: 'Restaurer la carte' },
  removed: { current: 'Garder la carte', version: 'Retirer de la fiche' },
};

const norm = (text?: string | null) => (text ?? '').replace(/\r\n/g, '\n').trimEnd();
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

  // Recherche, tri et version affichée : on réutilise le même hook que les chapitres et les idées
  const compare = useVersionCompare({
    versions,
    selectedVersion,
    currentText: '',
    getText: () => '',
  });

  const [mergeFields, setMergeFields] = useState({ name: true, cards: true });
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [hideSame, setHideSame] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
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
    const result: Record<CardStatus, number> = { same: 0, changed: 0, added: 0, removed: 0 };
    rows.forEach((row) => {
      result[row.status] += 1;
    });
    return result;
  }, [rows]);

  const differences = counts.changed + counts.added + counts.removed;
  const visibleRows = hideSame ? rows.filter((row) => row.status !== 'same') : rows;

  const applyAll = (choice: Choice) => {
    const next: Record<string, Choice> = {};
    rows.forEach((row) => {
      if (row.status !== 'same') next[row.key] = choice;
    });
    setChoices(next);
  };

  /** Ce que la fiche contiendra après fusion, d'après les choix et les champs cochés. */
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
      if (mergeFields.name && versionToCompare.name !== sheet.name) {
        await offlineSheetService.update(sheet.id, { name: versionToCompare.name });
      }

      if (mergeFields.cards) {
        // les cartes restaurées s'ajoutent à la fin de la fiche
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

  const segment = (active: boolean) =>
    `px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
      active ? 'bg-amber-700 text-amber-50 shadow-sm' : 'text-amber-200/70 hover:text-amber-200'
    }`;

  const bulkBtn =
    'cursor-pointer rounded-lg border border-amber-900/30 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-neutral-800';

  const sideBox = (kind: 'current' | 'version', row: CardRow) => {
    const isCurrent = kind === 'current';
    const text = isCurrent ? row.current : row.snap;
    const choice = choiceOf(row);
    const dropped = row.status !== 'same' && (isCurrent ? choice === 'version' : choice === 'current');

    return (
      <div className="min-w-0">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-amber-200/40">{isCurrent ? 'Actuelle' : 'Version'}</div>
        <div
          className={`rounded-lg px-3 py-2 text-sm text-amber-100/80 wrap-break-word ${
            !text
              ? 'italic text-amber-200/30'
              : isCurrent
                ? 'bg-red-950/25'
                : 'bg-emerald-950/25'
          } ${dropped && text ? 'opacity-45' : ''}`}
        >
          {text ? (
            <>
              <div className={`font-semibold ${dropped ? 'line-through' : ''}`}>{text.name}</div>
              <div className={`mt-1 whitespace-pre-wrap leading-relaxed ${dropped ? 'line-through' : ''}`}>
                {text.description?.trim() ? text.description : <span className="italic text-amber-200/30">(vide)</span>}
              </div>
            </>
          ) : (
            'absente'
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#1c1411] text-[#fcf9f2] font-serif">
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
            isRestoring={isRestoring}
            onView={(version) => navigate(`${versionsPath}/${version.id}`)}
            onMerge={(version) => navigate(`${versionsPath}/${version.id}`)}
            onDelete={handleDelete}
          />

          {versions.length === 0 && (
            <p className="text-center text-sm text-amber-200/50 font-sans">
              Aucune version pour le moment. « Enregistrer une version » garde la fiche entière : son nom et toutes ses cartes.
            </p>
          )}

          {versionToCompare && (
            <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/70 p-3 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
              <div>
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-200/40 mb-1">Comparaison</p>
                <h2 className="text-xl sm:text-3xl font-bold text-amber-100">Version {versionToCompare.versionNumber} et fiche actuelle</h2>
                {versionToCompare.name !== sheet.name && (
                  <p className="mt-1 text-sm text-amber-200/60 font-sans">
                    Le nom a changé : « {versionToCompare.name} » dans la version, « {sheet.name} » aujourd’hui.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 font-sans">
                <div className="flex p-1 bg-neutral-950/50 rounded-lg border border-amber-900/30">
                  <button onClick={() => setShowPreview(false)} className={segment(!showPreview)}>
                    Comparatif par carte
                  </button>
                  <button onClick={() => setShowPreview(true)} className={segment(showPreview)}>
                    Aperçu de la fusion
                  </button>
                </div>

                {!showPreview && (
                  <label className="flex items-center gap-2 text-sm text-amber-200/80 cursor-pointer hover:text-amber-100 transition-colors">
                    <input type="checkbox" checked={hideSame} onChange={(e) => setHideSame(e.target.checked)} className="size-4 cursor-pointer" />
                    Masquer les cartes identiques
                  </label>
                )}
              </div>

              {showPreview ? (
                <div className="p-4 sm:p-5 rounded-xl border border-amber-900/30 bg-neutral-900/40">
                  <h4 className="text-xs font-sans font-semibold text-amber-200/50 uppercase tracking-widest mb-4">
                    Rendu final de la fiche
                  </h4>
                  <h3 className="mb-4 text-2xl font-bold text-amber-100 wrap-break-word">{result.name}</h3>

                  {result.cards.length === 0 ? (
                    <p className="italic text-amber-200/50">Aucune carte.</p>
                  ) : (
                    <ul className="space-y-4">
                      {result.cards.map((card) => (
                        <li key={card.key}>
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="font-bold text-amber-200">{card.name}</h5>
                            {card.tag && (
                              <span className="rounded-full border border-amber-800/40 bg-amber-950 px-2 py-0.5 font-sans text-[10px] text-amber-300">
                                {card.tag}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed text-amber-100/90 wrap-break-word">
                            {card.description.trim() || <span className="italic text-amber-200/30">À compléter…</span>}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 font-sans">
                    <p className="text-xs sm:text-sm text-amber-200/60">
                      {differences === 0
                        ? 'La version est identique à la fiche actuelle.'
                        : `${counts.changed} modifiée${counts.changed > 1 ? 's' : ''} · ${counts.added} supprimée${counts.added > 1 ? 's' : ''} depuis · ${counts.removed} ajoutée${counts.removed > 1 ? 's' : ''} depuis · ${counts.same} identique${counts.same > 1 ? 's' : ''}`}
                    </p>
                    {differences > 0 && (
                      <div className="flex gap-2">
                        <button onClick={() => applyAll('current')} className={bulkBtn}>
                          Tout l’actuel
                        </button>
                        <button onClick={() => applyAll('version')} className={bulkBtn}>
                          Toute la version
                        </button>
                      </div>
                    )}
                  </div>

                  {visibleRows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-amber-200/50 text-sm">
                      {rows.length === 0 ? 'Aucune carte à comparer.' : 'Aucune différence : toutes les cartes sont identiques.'}
                    </div>
                  ) : (
                    <ul className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                      {visibleRows.map((row) => {
                        const title = (row.current ?? row.snap)?.name ?? '';
                        const choice = choiceOf(row);
                        return (
                          <li key={row.key} className="rounded-xl border border-amber-900/20 bg-neutral-950/60 p-3 sm:p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 font-sans">
                              <span className="min-w-0 truncate font-serif font-semibold text-amber-100">{title}</span>
                              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[row.status]}`}>
                                {STATUS_LABEL[row.status]}
                              </span>
                            </div>

                            {row.status === 'same' ? (
                              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-amber-100/70 wrap-break-word">
                                {row.current?.description?.trim() || <span className="italic text-amber-200/30">(vide)</span>}
                              </p>
                            ) : (
                              <>
                                <div className="grid gap-3 md:grid-cols-2">
                                  {sideBox('current', row)}
                                  {sideBox('version', row)}
                                </div>
                                <div className="flex flex-wrap gap-2 font-sans">
                                  {(['current', 'version'] as const).map((value) => (
                                    <button
                                      key={value}
                                      onClick={() => setChoices((current) => ({ ...current, [row.key]: value }))}
                                      aria-pressed={choice === value}
                                      className={`px-3 py-2 rounded-md text-xs border cursor-pointer touch-target ${
                                        choice === value
                                          ? 'bg-amber-700 text-amber-50 border-amber-600'
                                          : 'bg-neutral-900 text-amber-200 border-amber-900/30'
                                      }`}
                                    >
                                      {CHOICE_LABELS[row.status as Exclude<CardStatus, 'same'>][value]}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              <MergeOptions
                fields={MERGE_FIELDS}
                value={mergeFields}
                onChange={setMergeFields}
                onMerge={() => void handleMerge()}
                isRestoring={isRestoring}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default SheetVersionsPage;