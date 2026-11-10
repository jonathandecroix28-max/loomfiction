import { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useNavigate, useParams } from 'react-router-dom';
import { useSheetPage } from '../hooks/useSheetPage';
import { useSheets } from '../hooks/useSheets';
import { SheetCardItem } from '../components/SheetCardItem';
import { SheetDocument } from '../components/SheetDocument';
import { ActionMenu, type ActionMenuItem } from '../components/ActionMenu';
import { AttachNotesModal } from '../components/AttachNotesModal';
import { IdeaModal } from '../../ideas/components/IdeaModal';
import { MentionDetection, type DetectionTarget } from '../../editor/components/MentionDetection';
import type { Editor } from '@tiptap/core';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineSheetVersionService } from '../../../services/offlineSheetVersionService';
import { exportSheetToJson, exportSheetToMarkdownFile } from '../services/sheetExchange';
import { toUpsert } from '../sheetLinks';
import type { IdeaResponse } from '../../../types/idea';
import { useConfirm, useToast } from '../../../components/feedback/FeedbackProvider';
import {
  IconAdd,
  IconAttach,
  IconBack,
  IconCopy,
  IconDelete,
  IconEdit,
  IconFile,
  IconHistory,
  IconPrint,
  IconSave,
} from '../../../components/icons';

type Mode = 'cards' | 'document';

const toolbarBtn = 'cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium transition touch-target';



function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';

  const cleanHtml = DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-type', 'data-id', 'data-label'],
  });

  const document = new DOMParser().parseFromString(cleanHtml, 'text/html');

  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof Element)) return '';

    if (node.matches('[data-type="mention"]')) {
      const label = node.getAttribute('data-label')?.trim() || node.textContent?.trim() || '';
      return label ? `@${label.replace(/^@/, '')}` : '';
    }

    const content = Array.from(node.childNodes).map(inline).join('');

    switch (node.tagName.toLowerCase()) {
      case 'br':
        return '\n';
      case 'strong':
      case 'b':
        return content ? `**${content}**` : '';
      case 'em':
      case 'i':
        return content ? `*${content}*` : '';
      case 'code':
        return content ? `\`${content.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`` : '';
      case 'a': {
        const href = node.getAttribute('href')?.trim();
        return href ? `[${content}](${href})` : content;
      }
      default:
        return content;
    }
  };

  const blocks = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof Element)) return '';

    if (node.matches('[data-type="mention"]')) return inline(node);

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes);

    if (tag === 'ul' || tag === 'ol') {
      const items = children
        .filter((child): child is Element => child instanceof Element && child.tagName.toLowerCase() === 'li')
        .map((item, index) => {
          const text = Array.from(item.childNodes).map(blocks).join('').trim();
          const prefix = tag === 'ol' ? `${index + 1}. ` : '- ';
          return text ? `${prefix}${text}` : '';
        })
        .filter(Boolean);
      return items.join('\n');
    }

    if (tag === 'li') return children.map(blocks).join('');
    if (tag === 'blockquote') {
      const content = children.map(blocks).join('').trim();
      return content.split('\n').map((line) => `> ${line}`).join('\n');
    }
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      return `${'#'.repeat(level)} ${children.map(inline).join('').trim()}`;
    }
    if (tag === 'p' || tag === 'div' || tag === 'section') {
      const content = children.map((child) => {
        if (child instanceof Element && ['ul', 'ol', 'blockquote'].includes(child.tagName.toLowerCase())) {
          return blocks(child);
        }
        return inline(child);
      }).join('').trim();
      return content;
    }

    if (tag === 'br') return '\n';
    return children.map((child) => {
      if (child instanceof Element && /^(p|div|section|ul|ol|blockquote|h[1-6])$/.test(child.tagName.toLowerCase())) {
        return blocks(child);
      }
      return inline(child);
    }).join('');
  };

  return Array.from(document.body.childNodes)
    .map(blocks)
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


export function SheetPage() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const numSheetId = sheetId ? Number(sheetId) : null;

  const { sheet, category, cards, setCards, isLoading, error, reload } = useSheetPage(numSheetId);

  const [mode, setMode] = useState<Mode>('cards');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<IdeaResponse | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [feedback, setFeedback] = useState('');

  // « Détecter les fiches » sur toutes les cartes à la fois : chaque carte donne son éditeur à la page
  const { sheets: allSheets } = useSheets();
  const editorsRef = useRef(new Map<number, Editor>());
  const [detectTargets, setDetectTargets] = useState<DetectionTarget[] | null>(null);

  const registerEditor = useCallback((cardId: number, editor: Editor | null) => {
    if (editor) editorsRef.current.set(cardId, editor);
    else editorsRef.current.delete(cardId);
  }, []);

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
  const versionsPath = `/ideas/fiches/${sheet.id}/versions`;

  const flash = (text: string) => {
    setFeedback(text);
    setTimeout(() => setFeedback(''), 2500);
  };

  const openCreate = () => {
    setCardToEdit(null);
    setIsModalOpen(true);
  };

  const openDetection = () => {
    const targets = cards.flatMap((card) => {
      const editor = editorsRef.current.get(card.id);
      return editor ? [{ id: card.id, label: card.name, editor }] : [];
    });
    setDetectTargets(targets);
  };

  const openEdit = (card: IdeaResponse) => {
    setCardToEdit(card);
    setIsModalOpen(true);
  };

  const moveCard = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= cards.length) return;

    const reordered = [...cards];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withOrder = reordered.map((card, position) => ({ ...card, sortOrder: position }));

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

  const saveCardDescription = async (card: IdeaResponse, description: string): Promise<boolean> => {
    try {
      await offlineIdeaService.update(card.id, { ...toUpsert(card), description });
      setCards((current) => current.map((item) => (item.id === card.id ? { ...item, description } : item)));
      return true;
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de la description :", err);
      return false;
    }
  };

  const deleteCard = async (card: IdeaResponse) => {
    const ok = await confirm({
      title: `Supprimer la carte « ${card.name} » ?`,
      message: 'Cette action est irréversible.',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await offlineIdeaService.remove(card.id);
      await reload();
      toast.success('Carte supprimée');
    } catch (err) {
      console.error('Erreur lors de la suppression de la carte :', err);
      toast.error('Impossible de supprimer cette carte.');
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
      toast.error('Impossible de renommer la fiche.');
    }
  };

  const deleteSheet = async () => {
    const cardsNote =
      cards.length === 0
        ? ''
        : cards.length === 1
          ? 'Sa carte sera supprimée avec elle. '
          : `Ses ${cards.length} cartes seront supprimées avec elle. `;

    const ok = await confirm({
      title: `Supprimer la fiche « ${sheet.name} » ?`,
      message: `${cardsNote}Cette action est irréversible.`,
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await offlineSheetService.remove(sheet.id);
      toast.success('Fiche supprimée');
      navigate('/ideas', { replace: true });
    } catch (err) {
      console.error('Erreur lors de la suppression de la fiche :', err);
      toast.error('Impossible de supprimer la fiche.');
    }
  };

  const copyMarkdown = async () => {
    const parts = [`# ${sheet.name}`, category ? `*${category.name}*` : ''];

    for (const card of cards) {
      const description = htmlToMarkdown(card.description ?? '');
      if (description) {
        parts.push(`## ${card.name}\n\n${description}`);
      }
    }

    try {
      await navigator.clipboard.writeText(parts.filter(Boolean).join('\n\n'));
      flash('Fiche copiée en Markdown.');
    } catch {
      flash('Copie impossible : autorisez l’accès au presse-papiers.');
    }
  };

  const saveVersion = async () => {
    try {
      const version = await offlineSheetVersionService.createFromSheet(sheet, cards);
      flash(`Version ${version.versionNumber} enregistrée (${cards.length} ${cards.length > 1 ? 'cartes' : 'carte'}).`);
    } catch (err) {
      console.error('Erreur lors de la création de la version de fiche :', err);
      flash('Impossible d’enregistrer la version.');
    }
  };

  const menuItems: ActionMenuItem[] = [
    { key: 'save-version', label: 'Enregistrer une version', icon: IconSave, onSelect: () => void saveVersion() },
    { key: 'versions', label: 'Historique des versions', icon: IconHistory, onSelect: () => navigate(versionsPath) },
    { key: 'attach', label: 'Ajouter des notes existantes', icon: IconAttach, separatorBefore: true, onSelect: () => setIsAttachOpen(true) },
    { key: 'print', label: 'Imprimer / PDF', icon: IconPrint, onSelect: () => { setMode('document'); setTimeout(() => window.print(), 100); } },
    { key: 'json', label: 'Exporter en JSON', icon: IconFile, separatorBefore: true, onSelect: () => exportSheetToJson(sheet, category, cards) },
    {
      key: 'md',
      label: 'Exporter en Markdown',
      icon: IconFile,
      onSelect: () => exportSheetToMarkdownFile(sheet, category, cards),
    },
    { key: 'copy', label: 'Copier le Markdown', icon: IconCopy, onSelect: () => void copyMarkdown() },
    { key: 'delete', label: 'Supprimer la fiche', icon: IconDelete, danger: true, separatorBefore: true, onSelect: () => void deleteSheet() },
  ];

  return (
    <div className="min-h-screen bg-[#1c1411] font-serif text-[#fcf9f2] print:bg-white">
      <header className="border-b border-amber-900/40 bg-neutral-950/80 px-4 py-4 sm:px-6 print:hidden">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {/* Ligne du haut : retour à gauche, menu d'actions à droite */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => navigate('/ideas')}
              className="touch-target flex cursor-pointer items-center gap-1 font-sans text-sm text-amber-200/60 transition-colors hover:text-amber-100"
            >
              <IconBack className="size-4" aria-hidden="true" />
              Carnet
            </button>

            <ActionMenu label="Actions de la fiche" items={menuItems} />
          </div>

          <div className="min-w-0">
            {category && (
              <p className="mb-1 flex items-center gap-2 font-sans text-xs uppercase tracking-[0.2em] text-amber-200/60">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                {category.name}
              </p>
            )}

            {isRenaming ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveName();
                }}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input
                  value={draftName}
                  autoFocus
                  onChange={(event) => setDraftName(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-amber-900/40 bg-neutral-900 px-4 py-2 text-2xl font-bold text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="submit" className={`${toolbarBtn} border-amber-600 bg-amber-700 text-amber-50 hover:bg-amber-600`}>
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    className={`${toolbarBtn} border-amber-900/30 bg-neutral-900 text-amber-200 hover:bg-neutral-800`}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="min-w-0 truncate text-3xl font-bold text-amber-100 sm:text-4xl">{sheet.name}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(sheet.name);
                    setIsRenaming(true);
                  }}
                  aria-label="Renommer la fiche"
                  title="Renommer la fiche"
                  className="touch-target inline-flex min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-amber-200/50 transition hover:text-amber-100"
                >
                  <IconEdit className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <p className="mt-1 font-sans text-sm text-amber-200/50">
              {cards.length} {cards.length > 1 ? 'cartes' : 'carte'} · {filled} {filled > 1 ? 'remplies' : 'remplie'}
            </p>
          </div>

          {/* Bascule Cartes / Fiche : pleine largeur sur mobile */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-amber-900/30 bg-neutral-950/50 p-1 font-sans sm:w-72">
            {(['cards', 'document'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`touch-target cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === value ? 'bg-amber-700 text-amber-50 shadow-sm' : 'text-amber-200/70 hover:text-amber-100'
                }`}
              >
                {value === 'cards' ? 'Cartes' : 'Fiche'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        {feedback && (
          <div
            role="status"
            className="rounded-xl border border-emerald-900/30 bg-emerald-950/30 px-4 py-3 font-sans text-sm text-emerald-300 print:hidden"
          >
            {feedback}
          </div>
        )}

        {/* Action principale (pleine largeur sur mobile) + détection des fiches sur toute la fiche (icône seule sur mobile) */}
        {mode === 'cards' && cards.length > 0 && (
          <div className="flex gap-2 print:hidden">
            <button
              onClick={openCreate}
              className={`${toolbarBtn} flex flex-1 items-center justify-center gap-1.5 border-amber-600 bg-amber-700 font-sans text-amber-50 shadow-md hover:bg-amber-600 sm:flex-none`}
            >
              <IconAdd className="size-4" aria-hidden="true" />
              Ajouter une caractéristique
            </button>

            <button
              onClick={openDetection}
              disabled={allSheets.length === 0}
              title="Repérer les noms de fiches dans toutes les cartes"
              aria-label="Détecter les fiches dans toutes les cartes"
              className={`${toolbarBtn} flex shrink-0 items-center justify-center gap-1.5 border-amber-800/50 bg-amber-950/40 font-sans text-amber-200 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span aria-hidden="true">✦</span>
              <span className="hidden sm:inline">Détecter les fiches</span>
            </button>
          </div>
        )}

        {cards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-amber-900/30 bg-neutral-950/40 px-6 py-16 text-center print:hidden">
            <p className="mb-4 text-lg text-amber-200/60">Cette fiche n'a pas encore de carte.</p>

            <button
              onClick={openCreate}
              className={`${toolbarBtn} inline-flex items-center gap-1.5 border-amber-600 bg-amber-700 font-sans text-amber-50 shadow-md hover:bg-amber-600`}
            >
              <IconAdd className="size-4" aria-hidden="true" />
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
                onMove={(position, delta) => void moveCard(position, delta)}
                onEdit={openEdit}
                onDelete={(target) => void deleteCard(target)}
                onSaveDescription={saveCardDescription}
                onEditorChange={registerEditor}
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

      <AttachNotesModal
        isOpen={isAttachOpen}
        sheet={sheet}
        cards={cards}
        onClose={() => setIsAttachOpen(false)}
        onAttached={reload}
      />

      {detectTargets && (
        <MentionDetection targets={detectTargets} sheets={allSheets} onClose={() => setDetectTargets(null)} />
      )}
    </div>
  );
}

export default SheetPage;