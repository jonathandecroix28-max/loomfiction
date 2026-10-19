
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSheetPage } from '../hooks/useSheetPage';
import { SheetCardItem } from '../components/SheetCardItem';
import { SheetDocument } from '../components/SheetDocument';
import { IdeaModal } from '../../ideas/components/IdeaModal';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import type { IdeaResponse, IdeaUpsertRequest } from '../../../types/idea';

type Mode = 'cards' | 'document';

const toUpsert = (card: IdeaResponse): IdeaUpsertRequest => ({
  name: card.name,
  description: card.description,
  bookId: card.bookId,
  categoryId: card.categoryId,
  status: card.status,
  sortOrder: card.sortOrder,
});

const toolbarBtn =
  'cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium transition touch-target';

export function SheetPage() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const numSheetId = sheetId ? Number(sheetId) : null;

  const {
    sheet,
    category,
    cards,
    setCards,
    isLoading,
    error,
    reload,
  } = useSheetPage(numSheetId);

  const [mode, setMode] = useState<Mode>('cards');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<IdeaResponse | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!isLoading && (error || !sheet)) {
      navigate('/404', { replace: true });
    }
  }, [isLoading, error, sheet, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1c1411] font-serif text-amber-200/60">
        Ouverture de la fiche...
      </div>
    );
  }

  if (error || !sheet) return null;

  const filled = cards.filter((card) => card.description?.trim()).length;

  const flash = (text: string) => {
    setFeedback(text);
    setTimeout(() => setFeedback(''), 2500);
  };

  const openCreate = () => {
    setCardToEdit(null);
    setIsModalOpen(true);
  };

  const openEdit = (card: IdeaResponse) => {
    setCardToEdit(card);
    setIsModalOpen(true);
  };

  const moveCard = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= cards.length) return;

    const reordered = [...cards];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];

    const withOrder = reordered.map((card, position) => ({
      ...card,
      sortOrder: position,
    }));

    setCards(withOrder);

    try {
      for (const [position, card] of withOrder.entries()) {
        const before = cards.find((c) => c.id === card.id);

        if (before?.sortOrder !== position) {
          await offlineIdeaService.update(card.id, toUpsert(card));
        }
      }
    } catch (err) {
      console.error('Erreur lors du changement d’ordre :', err);
      await reload();
    }
  };

  const saveCardDescription = async (
    card: IdeaResponse,
    description: string,
  ): Promise<boolean> => {
    try {
      await offlineIdeaService.update(card.id, {
        ...toUpsert(card),
        description,
      });

      setCards((current) =>
        current.map((item) =>
          item.id === card.id
            ? { ...item, description }
            : item,
        ),
      );

      flash('Description enregistrée.');
      return true;
    } catch (err) {
      console.error(
        "Erreur lors de l'enregistrement de la description :",
        err,
      );

      flash("Impossible d'enregistrer la description.");
      await reload();
      return false;
    }
  };

  const deleteCard = async (card: IdeaResponse) => {
    if (!confirm(`Supprimer la carte « ${card.name} » ?`)) return;

    try {
      await offlineIdeaService.remove(card.id);
      await reload();
    } catch (err) {
      console.error('Erreur lors de la suppression de la carte :', err);
      alert('Impossible de supprimer cette carte.');
    }
  };

  const saveName = async () => {
    const name = draftName.trim();
    if (!name) return;

    try {
      await offlineSheetService.update(sheet.id, { name });
      setIsRenaming(false);
      await reload();
    } catch (err) {
      console.error('Erreur lors du renommage de la fiche :', err);
      alert('Impossible de renommer la fiche.');
    }
  };

  const deleteSheet = async () => {
    const detail =
      cards.length > 0
        ? ` et ses ${cards.length} ${cards.length > 1 ? 'cartes' : 'carte'}`
        : '';

    if (
      !confirm(
        `Supprimer la fiche « ${sheet.name} »${detail} ? Cette action est irréversible.`,
      )
    ) {
      return;
    }

    try {
      await offlineSheetService.remove(sheet.id);
      navigate('/ideas', { replace: true });
    } catch (err) {
      console.error('Erreur lors de la suppression de la fiche :', err);
      alert('Impossible de supprimer la fiche.');
    }
  };

  const copyMarkdown = async () => {
    const parts = [
      `# ${sheet.name}`,
      category ? `*${category.name}*` : '',
    ];

    for (const card of cards) {
      if (card.description?.trim()) {
        parts.push(`## ${card.name}\n\n${card.description.trim()}`);
      }
    }

    try {
      await navigator.clipboard.writeText(parts.filter(Boolean).join('\n\n'));
      flash('Fiche copiée en Markdown.');
    } catch {
      flash('Copie impossible : autorisez l’accès au presse-papiers.');
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1411] font-serif text-[#fcf9f2] print:bg-white">
      <header className="border-b border-amber-900/40 bg-neutral-950/80 px-4 py-4 sm:px-6 print:hidden">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <button
            onClick={() => navigate('/ideas')}
            className="touch-target flex cursor-pointer items-center gap-1 self-start font-sans text-sm text-amber-200/60 transition-colors hover:text-amber-100"
          >
            &larr; Retour au carnet
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {category && (
                <p className="mb-1 flex items-center gap-2 font-sans text-xs uppercase tracking-[0.2em] text-amber-200/60">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </p>
              )}

              {isRenaming ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveName();
                  }}
                  className="flex flex-wrap gap-2"
                >
                  <input
                    value={draftName}
                    autoFocus
                    onChange={(event) => setDraftName(event.target.value)}
                    className="min-w-0 rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2 text-2xl font-bold text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />

                  <button
                    type="submit"
                    className={`${toolbarBtn} border-amber-600 bg-amber-700 text-amber-50 hover:bg-amber-600`}
                  >
                    Enregistrer
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    className={`${toolbarBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
                  >
                    Annuler
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="truncate text-3xl font-bold text-amber-100 sm:text-4xl">
                    {sheet.name}
                  </h1>

                  <button
                    onClick={() => {
                      setDraftName(sheet.name);
                      setIsRenaming(true);
                    }}
                    className="shrink-0 cursor-pointer font-sans text-xs text-amber-200/50 underline hover:text-amber-100"
                  >
                    Renommer
                  </button>
                </div>
              )}

              <p className="mt-1 font-sans text-sm text-amber-200/50">
                {cards.length} {cards.length > 1 ? 'cartes' : 'carte'} · {filled}{' '}
                {filled > 1 ? 'remplies' : 'remplie'}
              </p>
            </div>

            <div className="flex shrink-0 gap-2 font-sans">
              {(['cards', 'document'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={`${toolbarBtn} ${
                    mode === value
                      ? 'border-amber-600 bg-amber-700 text-amber-50'
                      : 'border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800'
                  }`}
                >
                  {value === 'cards' ? 'Cartes' : 'Fiche'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6 print:max-w-none print:p-0">
        {feedback && (
          <div
            role="status"
            className="rounded-xl border border-emerald-900/30 bg-emerald-950/30 px-4 py-3 font-sans text-sm text-emerald-300 print:hidden"
          >
            {feedback}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 font-sans print:hidden">
          <div className="flex flex-wrap gap-2">
            {mode === 'cards' ? (
              <button
                onClick={openCreate}
                className={`${toolbarBtn} border-amber-600 bg-amber-700 text-amber-50 shadow-md hover:bg-amber-600`}
              >
                + Ajouter une caractéristique
              </button>
            ) : (
              <>
                <button
                  onClick={() => void copyMarkdown()}
                  className={`${toolbarBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
                >
                  📋 Copier en Markdown
                </button>

                <button
                  onClick={() => window.print()}
                  className={`${toolbarBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
                >
                  🖨️ Imprimer / PDF
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => void deleteSheet()}
            className={`${toolbarBtn} border-red-900/30 bg-red-950/50 text-red-300 hover:bg-red-900/80`}
          >
            Supprimer la fiche
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-amber-900/30 bg-neutral-950/40 px-6 py-16 text-center print:hidden">
            <p className="mb-2 text-lg text-amber-200/60">
              Cette fiche n'a pas encore de carte.
            </p>

            <button
              onClick={openCreate}
              className="cursor-pointer font-sans text-sm text-amber-400 underline hover:text-amber-300"
            >
              Ajouter la première caractéristique
            </button>
          </div>
        ) : mode === 'cards' ? (
          <div className="space-y-4">
            {cards.map((card, index) => (
              <SheetCardItem
                key={card.id}
                card={card}
                index={index}
                total={cards.length}
                onMove={(position, delta) =>
                  void moveCard(position, delta)
                }
                onEdit={openEdit}
                onVersions={(target) =>
                  navigate(`/ideas/${target.id}/versions`)
                }
                onDelete={(target) => void deleteCard(target)}
                onSaveDescription={saveCardDescription}
              />
            ))}
          </div>
        ) : (
          <SheetDocument sheet={sheet} category={category} cards={cards} />
        )}
      </main>

      <IdeaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bookId={null}
        ideaToEdit={cardToEdit}
        sheetId={sheet.id}
        lockedCategoryId={sheet.categoryId}
        sortOrder={cards.length}
        onSuccess={() => void reload()}
      />
    </div>
  );
}

export default SheetPage;
