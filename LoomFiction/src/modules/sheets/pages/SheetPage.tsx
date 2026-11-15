import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSheetPage } from '../hooks/useSheetPage';
import { useSheets } from '../hooks/useSheets';
import { SheetCardItem } from '../components/SheetCardItem';
import { SheetDocument } from '../components/SheetDocument';
import { ActionMenu, type ActionMenuItem } from '../components/ActionMenu';
import { AttachNotesModal } from '../components/AttachNotesModal';
import { SheetConfigModal } from '../components/SheetConfigModal';
import { MentionDetection, type DetectionTarget } from '../../editor/components/MentionDetection';
import { SheetExplorer } from '../components/SheetExplorer';
import type { Editor } from '@tiptap/core';
import { offlineIdeaService } from '../../../services/offlineIdeaService';
import { offlineSheetService } from '../../../services/offlineSheetService';
import { offlineSheetVersionService } from '../../../services/offlineSheetVersionService';
import { exportSheetToJson, exportSheetToMarkdownFile } from '../services/sheetExchange';
import { toUpsert } from '../sheetLinks';
import type { IdeaResponse } from '../../../types/idea';
import type { SheetVersionResponse } from '../../../types/sheetVersion';
import { useConfirm, useToast } from '../../../components/feedback/FeedbackProvider';
import { notifyDataChanged, useDataChanged } from '../../../hooks/useDataChanged';
import {
  IconAdd,
  IconAttach,
  IconBack,
  IconCopy,
  IconDelete,
  IconEdit,
  IconFile,
  IconHistory,
  IconMenu,
  IconPrint,
  IconSave,
  IconSettings,
  IconClose,
} from '../../../components/icons';

type Mode = 'cards' | 'document';

// Version transmise par l'explorateur via l'état de navigation quand elle appartient à une autre fiche.
function versionFromNavigationState(state: unknown, sheetId: number | null): SheetVersionResponse | null {
  const version = (state as { version?: SheetVersionResponse } | null)?.version;
  return version && sheetId !== null && version.sheetId === sheetId ? version : null;
}

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
  const location = useLocation();
  const confirm = useConfirm();
  const toast = useToast();
  const numSheetId = sheetId ? Number(sheetId) : null;

  const { sheet, category, cards, setCards, isLoading, error, reload } = useSheetPage(numSheetId);

  const [mode, setMode] = useState<Mode>('cards');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [feedback, setFeedback] = useState('');

  // La version affichée n'est valable que pour sa propre fiche : elle est comparée à cette fiche, jamais à une autre.
  const [storedVersion, setActiveVersion] = useState<SheetVersionResponse | null>(() =>
    versionFromNavigationState(location.state, numSheetId),
  );
  const activeVersion = storedVersion && sheet && storedVersion.sheetId === sheet.id ? storedVersion : null;
  const [viewMode, setViewMode] = useState<'diff' | 'edit'>('diff');
  const [hideIdenticalLines, setHideIdenticalLines] = useState(false);
  const [reviewDecisions, setReviewDecisions] = useState<Record<number, boolean>>({});
  const [isReviewPreview, setIsReviewPreview] = useState(false);
  const [reviewPreviewCards, setReviewPreviewCards] = useState<IdeaResponse[]>([]);
  const [isApplyingReview, setIsApplyingReview] = useState(false);

  // À chaque navigation (changement de fiche, version ouverte depuis l'explorateur), on repart d'un état propre.
  const [appliedLocationKey, setAppliedLocationKey] = useState(location.key);
  if (location.key !== appliedLocationKey) {
    setAppliedLocationKey(location.key);
    setActiveVersion(versionFromNavigationState(location.state, numSheetId));
    setViewMode('diff');
    setHideIdenticalLines(false);
    setReviewDecisions({});
    setIsReviewPreview(false);
    setReviewPreviewCards([]);
  }

  const { sheets: allSheets, refreshSheets } = useSheets();

  // Synchronisation avec l'explorateur (et les modales) sans rechargement de page.
  useDataChanged((source) => {
    if (source === 'sheet-page') return;
    void refreshSheets();
    void reload();
  });
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

  const filled = cards.filter((card) => card.description?.trim()).length;

  const flash = (text: string) => {
    setFeedback(text);
    setTimeout(() => setFeedback(''), 2500);
  };

  const openCreateCard = () => {
    if (!sheet) return;
    const currentSheet = sheet;
    const createNewCard = async () => {
      try {
        await offlineIdeaService.create({
          name: 'Nouvelle caractéristique',
          description: '',
          categoryId: currentSheet.categoryId,
          sheetId: currentSheet.id,
          status: 'draft',
          sortOrder: cards.length,
          bookId: null,
        });
        await reload();
        notifyDataChanged('sheet-page');
        toast.success('Caractéristique ajoutée');
      } catch (err) {
        console.error('Erreur lors de la création de la carte :', err);
        toast.error('Impossible d’ajouter la caractéristique.');
      }
    };
    void createNewCard();
  };

  const openDetection = () => {
    const targets = cards.flatMap((card) => {
      const editor = editorsRef.current.get(card.id);
      return editor ? [{ id: card.id, label: card.name, editor }] : [];
    });
    setDetectTargets(targets);
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
      notifyDataChanged('sheet-page');
    } catch (err) {
      console.error('Erreur lors du changement d’ordre :', err);
      await reload();
    }
  };

  const saveCardDescription = async (card: IdeaResponse, description: string): Promise<boolean> => {
    if (activeVersion && viewMode === 'diff') return false;
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
      notifyDataChanged('sheet-page');
      toast.success('Carte supprimée');
    } catch (err) {
      console.error('Erreur lors de la suppression de la carte :', err);
      toast.error('Impossible de supprimer cette carte.');
    }
  };

  const saveName = async () => {
    if (!sheet) return;
    const currentSheet = sheet;
    const name = draftName.trim();
    if (!name) return;

    try {
      await offlineSheetService.update(currentSheet.id, { name });
      setIsRenaming(false);
      notifyDataChanged('sheet-page');
      await reload();
      toast.success('Fiche renommée');
    } catch (err) {
      console.error('Erreur lors du renommage de la fiche :', err);
      toast.error('Impossible de renommer la fiche.');
    }
  };

  const deleteSheet = async () => {
    if (!sheet) return;
    const currentSheet = sheet;
    const ok = await confirm({
      title: `Supprimer la fiche « ${currentSheet.name} » ?`,
      message: 'Cette action est irréversible.',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await offlineSheetService.remove(currentSheet.id);
      notifyDataChanged('sheet-page');
      toast.success('Fiche supprimée');
      navigate('/ideas', { replace: true });
    } catch (err) {
      console.error('Erreur lors de la suppression de la fiche :', err);
    }
  };

  const saveVersion = async () => {
    if (!sheet) return;
    const currentSheet = sheet;
    try {
      const version = await offlineSheetVersionService.createFromSheet(currentSheet, cards);
      notifyDataChanged('sheet-page');
      flash(`Version ${version.versionNumber} enregistrée (${cards.length} cartes).`);
    } catch (err) {
      console.error('Erreur version :', err);
      flash('Impossible d’enregistrer la version.');
    }
  };

  const diffGroups = useMemo(() => {
    type TextBlock = { text: string; raw: string; card: IdeaResponse };
    type EqualGroup = { type: 'equal'; oldBlock: TextBlock; currentBlock: TextBlock; oldLine: number; currentLine: number };
    type ChangeGroup = { type: 'change'; id: number; oldBlocks: TextBlock[]; currentBlocks: TextBlock[]; oldStart: number; currentStart: number };

    if (!activeVersion || viewMode !== 'diff') {
      return { groups: [] as Array<EqualGroup | ChangeGroup>, rows: [] as Array<{ left: string | null; right: string | null; type: 'equal' | 'removed' | 'added'; leftLine: number | null; rightLine: number | null; hunkId: number | null }> };
    }

    const cardsToBlocks = (list: IdeaResponse[]): TextBlock[] => list.map((card) => {
      const description = htmlToMarkdown(card.description || '');
      const name = String(card.name || 'Carte sans nom');
      const raw = [`### ${name}`, description].filter(Boolean).join('\n');
      const text = JSON.stringify({ id: card.id, name, description, sortOrder: card.sortOrder });
      return { text, raw, card };
    });

    const oldBlocks = cardsToBlocks(
      (activeVersion.cards || []).map((card) => ({ createdAt: '', updatedAt: '', ...card })),
    );
    const currentBlocks = cardsToBlocks(cards);
    const maxCells = 2_000_000;
    const events: Array<{ type: 'equal' | 'removed' | 'added'; oldIndex?: number; currentIndex?: number }> = [];

    if (oldBlocks.length * currentBlocks.length > maxCells) {
      oldBlocks.forEach((_, oldIndex) => events.push({ type: 'removed', oldIndex }));
      currentBlocks.forEach((_, currentIndex) => events.push({ type: 'added', currentIndex }));
    } else {
      const dp = Array.from({ length: oldBlocks.length + 1 }, () => new Uint32Array(currentBlocks.length + 1));
      for (let i = oldBlocks.length - 1; i >= 0; i--) {
        for (let j = currentBlocks.length - 1; j >= 0; j--) {
          dp[i][j] = oldBlocks[i].text === currentBlocks[j].text
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      let i = 0, j = 0;
      while (i < oldBlocks.length && j < currentBlocks.length) {
        if (oldBlocks[i].text === currentBlocks[j].text) {
          events.push({ type: 'equal', oldIndex: i++, currentIndex: j++ });
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
          events.push({ type: 'removed', oldIndex: i++ });
        } else {
          events.push({ type: 'added', currentIndex: j++ });
        }
      }
      while (i < oldBlocks.length) events.push({ type: 'removed', oldIndex: i++ });
      while (j < currentBlocks.length) events.push({ type: 'added', currentIndex: j++ });
    }

    const groups: Array<EqualGroup | ChangeGroup> = [];
    let cursor = 0;
    let changeId = 0;
    while (cursor < events.length) {
      const event = events[cursor];
      if (event.type === 'equal') {
        const oldIndex = event.oldIndex!;
        const currentIndex = event.currentIndex!;
        groups.push({ type: 'equal', oldBlock: oldBlocks[oldIndex], currentBlock: currentBlocks[currentIndex], oldLine: oldIndex + 1, currentLine: currentIndex + 1 });
        cursor++;
        continue;
      }
      const oldIndexes: number[] = [];
      const currentIndexes: number[] = [];
      while (cursor < events.length && events[cursor].type !== 'equal') {
        const changed = events[cursor++];
        if (changed.type === 'removed') oldIndexes.push(changed.oldIndex!);
        if (changed.type === 'added') currentIndexes.push(changed.currentIndex!);
      }
      groups.push({
        type: 'change',
        id: changeId++,
        oldBlocks: oldIndexes.map((index) => oldBlocks[index]),
        currentBlocks: currentIndexes.map((index) => currentBlocks[index]),
        oldStart: oldIndexes.length ? oldIndexes[0] + 1 : 0,
        currentStart: currentIndexes.length ? currentIndexes[0] + 1 : 0,
      });
    }

    type DiffRow = {
      left: string | null; right: string | null; type: 'equal' | 'removed' | 'added';
      leftLine: number | null; rightLine: number | null; hunkId: number | null;
    };
    const rows: DiffRow[] = [];
    let oldLineNumber = 1;
    let currentLineNumber = 1;

    const appendLineDiff = (oldRaw: string, currentRaw: string, hunkId: number | null) => {
      const oldLines = oldRaw.split(/\r?\n/);
      const currentLines = currentRaw.split(/\r?\n/);
      const lineEvents: Array<{ type: 'equal' | 'removed' | 'added'; oldIndex?: number; currentIndex?: number }> = [];
      if (oldLines.length * currentLines.length > maxCells) {
        oldLines.forEach((_, oldIndex) => lineEvents.push({ type: 'removed', oldIndex }));
        currentLines.forEach((_, currentIndex) => lineEvents.push({ type: 'added', currentIndex }));
      } else {
        const lineDp = Array.from({ length: oldLines.length + 1 }, () => new Uint32Array(currentLines.length + 1));
        for (let i = oldLines.length - 1; i >= 0; i--) {
          for (let j = currentLines.length - 1; j >= 0; j--) {
            lineDp[i][j] = oldLines[i] === currentLines[j]
              ? lineDp[i + 1][j + 1] + 1
              : Math.max(lineDp[i + 1][j], lineDp[i][j + 1]);
          }
        }
        let i = 0;
        let j = 0;
        while (i < oldLines.length && j < currentLines.length) {
          if (oldLines[i] === currentLines[j]) lineEvents.push({ type: 'equal', oldIndex: i++, currentIndex: j++ });
          else if (lineDp[i + 1][j] >= lineDp[i][j + 1]) lineEvents.push({ type: 'removed', oldIndex: i++ });
          else lineEvents.push({ type: 'added', currentIndex: j++ });
        }
        while (i < oldLines.length) lineEvents.push({ type: 'removed', oldIndex: i++ });
        while (j < currentLines.length) lineEvents.push({ type: 'added', currentIndex: j++ });
      }
      lineEvents.forEach((event) => {
        if (event.type === 'equal') {
          rows.push({ left: oldLines[event.oldIndex!], right: currentLines[event.currentIndex!], type: 'equal', leftLine: oldLineNumber++, rightLine: currentLineNumber++, hunkId });
        } else if (event.type === 'removed') {
          rows.push({ left: oldLines[event.oldIndex!], right: null, type: 'removed', leftLine: oldLineNumber++, rightLine: null, hunkId });
        } else {
          rows.push({ left: null, right: currentLines[event.currentIndex!], type: 'added', leftLine: null, rightLine: currentLineNumber++, hunkId });
        }
      });
    };

    const appendOneSided = (raw: string, side: 'old' | 'current', hunkId: number) => {
      raw.split(/\r?\n/).forEach((line) => {
        if (side === 'old') rows.push({ left: line, right: null, type: 'removed', leftLine: oldLineNumber++, rightLine: null, hunkId });
        else rows.push({ left: null, right: line, type: 'added', leftLine: null, rightLine: currentLineNumber++, hunkId });
      });
    };

    groups.forEach((group) => {
      if (group.type === 'equal') {
        appendLineDiff(group.oldBlock.raw, group.currentBlock.raw, null);
        return;
      }
      const remainingCurrent = new Map(group.currentBlocks.map((block) => [block.card.id, block]));
      group.oldBlocks.forEach((oldBlock) => {
        const currentBlock = remainingCurrent.get(oldBlock.card.id);
        if (currentBlock) {
          appendLineDiff(oldBlock.raw, currentBlock.raw, group.id);
          remainingCurrent.delete(oldBlock.card.id);
        } else {
          appendOneSided(oldBlock.raw, 'old', group.id);
        }
      });
      remainingCurrent.forEach((block) => appendOneSided(block.raw, 'current', group.id));
    });
    return { groups, rows };
  }, [activeVersion, viewMode, cards]);

  const visibleDiffRows = useMemo(
    () => hideIdenticalLines ? diffGroups.rows.filter((row) => row.type !== 'equal') : diffGroups.rows,
    [diffGroups, hideIdenticalLines],
  );

  const changeGroups = useMemo(
    () => diffGroups.groups.filter((group) => group.type === 'change'),
    [diffGroups],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#1c1411] font-serif text-amber-200/60">
        Ouverture de la fiche...
      </div>
    );
  }

  if (error || !sheet) return null;

  const versionsPath = `/ideas/fiches/${sheet.id}/versions`;

  const buildReviewPreview = () => {
    const nextCards = diffGroups.groups.flatMap((group) => {
      if (group.type === 'equal') return [group.currentBlock.card];
      const keepCurrent = reviewDecisions[group.id] !== false;
      return (keepCurrent ? group.currentBlocks : group.oldBlocks).map((block) => block.card);
    });
    setReviewPreviewCards(nextCards.map((card, sortOrder) => ({ ...card, sortOrder })));
    setIsReviewPreview(true);
  };

  const handleApplyReview = async () => {
    if (!sheet || !isReviewPreview || isApplyingReview) return;
    const currentSheet = sheet;
    setIsApplyingReview(true);
    setFeedback('');
    try {
      const currentById = new Map(cards.map((card) => [card.id, card]));
      const targetById = new Map(reviewPreviewCards.map((card) => [card.id, card]));

      for (const [sortOrder, targetCard] of reviewPreviewCards.entries()) {
        const payload = { ...toUpsert(targetCard), sortOrder };
        if (currentById.has(targetCard.id)) {
          await offlineIdeaService.update(targetCard.id, payload);
        } else {
          await offlineIdeaService.create({
            ...payload,
            categoryId: targetCard.categoryId ?? currentSheet.categoryId,
            sheetId: currentSheet.id,
            bookId: targetCard.bookId ?? null,
          });
        }
      }

      for (const currentCard of cards) {
        if (!targetById.has(currentCard.id)) {
          await offlineIdeaService.remove(currentCard.id);
        }
      }

      await reload();
      notifyDataChanged('sheet-page');
      setActiveVersion(null);
      setIsReviewPreview(false);
      setReviewPreviewCards([]);
      setReviewDecisions({});
      setHideIdenticalLines(false);
      flash('Modifications enregistrées et appliquées à la fiche.');
    } catch (error) {
      console.error('Erreur validation diff fiche :', error);
      flash('Erreur lors de l’enregistrement. Certaines opérations ont peut-être déjà été effectuées ; recharge la fiche avant de réessayer.');
    } finally {
      setIsApplyingReview(false);
    }
  };

  const menuItems: ActionMenuItem[] = [
    { key: 'config', label: 'Configuration globale de la fiche', icon: IconSettings, onSelect: () => setIsConfigOpen(true) },
    { key: 'save-version', label: 'Enregistrer une version', icon: IconSave, onSelect: () => void saveVersion() },
    { key: 'versions', label: 'Historique des versions', icon: IconHistory, onSelect: () => navigate(versionsPath) },
    { key: 'attach', label: 'Ajouter des notes existantes', icon: IconAttach, separatorBefore: true, onSelect: () => setIsAttachOpen(true) },
    { key: 'print', label: 'Imprimer / PDF', icon: IconPrint, onSelect: () => { setMode('document'); setTimeout(() => window.print(), 100); } },
    { key: 'json', label: 'Exporter en JSON', icon: IconFile, separatorBefore: true, onSelect: () => exportSheetToJson(sheet, category, cards) },
    { key: 'md', label: 'Exporter en Markdown', icon: IconFile, onSelect: () => exportSheetToMarkdownFile(sheet, category, cards) },
    { key: 'copy', label: 'Copier le Markdown', icon: IconCopy, onSelect: () => void copyMarkdown() },
    { key: 'delete', label: 'Supprimer la fiche', icon: IconDelete, danger: true, separatorBefore: true, onSelect: () => void deleteSheet() },
  ];

  const copyMarkdown = async () => {
    const parts = [`# ${sheet.name}`, category ? `*${category.name}*` : ''];
    for (const card of cards) {
      const description = htmlToMarkdown(card.description ?? '');
      if (description) parts.push(`## ${card.name}\n\n${description}`);
    }
    try {
      await navigator.clipboard.writeText(parts.filter(Boolean).join('\n\n'));
      flash('Fiche copiée en Markdown.');
    } catch {
      flash('Copie impossible.');
    }
  };

  return (
    <div className="flex flex-1 h-[calc(100dvh-4rem)] overflow-hidden bg-[#1c1411] font-serif text-[#fcf9f2] print:bg-white print:h-auto relative">
      <SheetExplorer
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        currentSheetId={sheet.id}
        onSelectSheetVersion={(version) => {
          if (version.sheetId !== sheet.id) {
            // La version appartient à une autre fiche : on ouvre cette fiche et on la compare avec ses propres cartes.
            navigate(`/ideas/fiches/${version.sheetId}`, { state: { version } });
            return;
          }
          setActiveVersion(version);
          setViewMode('diff');
          setHideIdenticalLines(false);
          setReviewDecisions({});
          setIsReviewPreview(false);
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col min-w-0 h-full overflow-hidden print:overflow-visible">
        <header className="shrink-0 border-b border-amber-900/40 bg-neutral-950/80 px-4 py-4 sm:px-6 print:hidden">
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (activeVersion) {
                      setActiveVersion(null);
                      setIsReviewPreview(false);
                    } else {
                      navigate('/ideas');
                    }
                  }}
                  className="touch-target flex cursor-pointer items-center gap-1 font-sans text-sm text-amber-200/60 transition-colors hover:text-amber-100"
                >
                  <IconBack className="size-4" aria-hidden="true" />
                  {activeVersion ? 'Fiche actuelle' : 'Carnet'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isExplorerOpen && (
                  <button
                    onClick={() => setIsExplorerOpen(true)}
                    title="Ouvrir l'explorateur"
                    aria-expanded={isExplorerOpen}
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-900 border border-amber-900/40 text-amber-200/70 transition-colors hover:bg-amber-900/20 hover:text-amber-100 touch-target shadow-md"
                  >
                    <IconMenu className="size-5" aria-hidden="true" />
                  </button>
                )}
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="touch-target flex items-center gap-1.5 rounded-xl border border-amber-800/50 bg-amber-950/40 px-3 py-2 font-sans text-xs text-amber-200 hover:bg-amber-900/50 transition cursor-pointer"
                >
                  <IconSettings className="size-4" />
                  <span className="hidden sm:inline">Configuration</span>
                </button>
                <ActionMenu label="Actions de la fiche" items={menuItems} />
              </div>
            </div>

            <div className="min-w-0">
              {category && (
                <p className="mb-1 flex items-center gap-2 font-sans text-xs uppercase tracking-[0.2em] text-amber-200/60">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name} {activeVersion ? `(v${activeVersion.versionNumber})` : ''}
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
                  {!activeVersion && (
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
                  )}
                  {activeVersion && (
                    <button
                      type="button"
                      onClick={() => { setActiveVersion(null); setIsReviewPreview(false); }}
                      aria-label="Fermer la comparaison"
                      className="touch-target inline-flex min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-900 text-amber-200 hover:bg-neutral-800"
                    >
                      <IconClose className="size-5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              <p className="mt-1 font-sans text-sm text-amber-200/50">
                {cards.length} {cards.length > 1 ? 'cartes' : 'carte'} · {filled} {filled > 1 ? 'remplies' : 'remplie'}
              </p>
            </div>

            {activeVersion && (
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-amber-900/30 bg-neutral-950/50 p-1 font-sans sm:w-96">
                {(['diff', 'edit'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value)}
                    aria-pressed={viewMode === value}
                    className={`touch-target cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition ${
                      viewMode === value ? 'bg-amber-700 text-amber-50 shadow-sm' : 'text-amber-200/70 hover:text-amber-100'
                    }`}
                  >
                    {value === 'diff' ? (
                      'Vue Diff'
                    ) : (
                      <>
                        <span className="sm:hidden">Modifier</span>
                        <span className="hidden sm:inline">Modifier cette version</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!activeVersion && (
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
            )}
          </div>
        </header>

        {activeVersion && viewMode === 'diff' && !isReviewPreview ? (
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#1e1e1e] font-mono text-xs sm:text-sm">
            <div className="flex shrink-0 flex-col gap-2 border-b border-amber-900/30 bg-[#252526] px-3 py-2 font-sans sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-neutral-300">
                  <input type="checkbox" checked={hideIdenticalLines} onChange={(event) => setHideIdenticalLines(event.target.checked)} className="size-4 accent-amber-600" />
                  Masquer les lignes identiques
                </label>
                <span className="shrink-0 text-[11px] text-neutral-400">{changeGroups.length} changement(s)</span>
              </div>
              <button
                type="button"
                onClick={buildReviewPreview}
                disabled={changeGroups.length === 0}
                className="touch-target w-full cursor-pointer rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                Prévisualiser le résultat
              </button>
            </div>

            {changeGroups.length > 0 && (
              <div className="flex shrink-0 snap-x gap-2 overflow-x-auto border-b border-amber-900/30 bg-[#222] p-2">
                {changeGroups.map((group, index) => {
                  const decision = reviewDecisions[group.id];
                  return (
                    <div key={group.id} className="flex w-44 shrink-0 snap-start flex-col gap-2 rounded-lg border border-neutral-700 bg-[#292929] p-2 sm:w-auto sm:flex-row sm:items-center">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans text-xs font-medium text-neutral-200">Changement {index + 1}</span>
                        <span className="font-sans text-[10px] text-neutral-500">{decision === undefined ? 'En attente' : decision ? 'Accepté' : 'Rejeté'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReviewDecisions((current) => ({ ...current, [group.id]: true }))}
                          className={`min-h-10 cursor-pointer rounded-md px-3 font-sans text-xs font-medium ${decision === true ? 'bg-emerald-700 text-white' : 'bg-neutral-700 text-neutral-200 hover:bg-emerald-900'}`}
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewDecisions((current) => ({ ...current, [group.id]: false }))}
                          className={`min-h-10 cursor-pointer rounded-md px-3 font-sans text-xs font-medium ${decision === false ? 'bg-red-800 text-white' : 'bg-neutral-700 text-neutral-200 hover:bg-red-950'}`}
                        >
                          Rejeter
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Desktop : 2 colonnes synchronisées */}
            <div className="hidden md:grid min-h-0 flex-1 grid-cols-2 divide-x divide-amber-900/30 overflow-y-auto">
              <section className="min-w-0">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-900/30 bg-[#252526] px-4 py-3 font-sans text-amber-200/70">
                  <span>v{activeVersion.versionNumber} {activeVersion.name ? `- ${activeVersion.name}` : ''}</span>
                  <span className="rounded bg-red-950/80 px-2 py-0.5 text-[10px] uppercase text-red-300">Ancienne version</span>
                </div>
                <div className="space-y-0.5 p-3">
                  {visibleDiffRows.map((row, idx) => (
                    <div key={`old-${idx}`} className={`flex min-h-7 rounded px-2 py-1 ${row.type === 'removed' ? 'bg-red-950/50 text-red-200' : row.type === 'equal' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      <span className="w-9 shrink-0 select-none pr-3 text-right text-neutral-500">{row.leftLine ?? ''}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{row.left ?? ' '}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="min-w-0">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-900/30 bg-[#252526] px-4 py-3 font-sans text-amber-200/70">
                  <span>Fiche actuelle</span>
                  <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] uppercase text-emerald-300">Actuel</span>
                </div>
                <div className="space-y-0.5 p-3">
                  {visibleDiffRows.map((row, idx) => (
                    <div key={`new-${idx}`} className={`flex min-h-7 rounded px-2 py-1 ${row.type === 'added' ? 'bg-emerald-950/50 text-emerald-200' : row.type === 'equal' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      <span className="w-9 shrink-0 select-none pr-3 text-right text-neutral-500">{row.rightLine ?? ''}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{row.right ?? ' '}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Mobile : un seul flux avec les suppressions puis les ajouts en contexte. */}
            <section className="md:hidden min-h-0 flex-1 overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-900/30 bg-[#252526] px-3 py-3 font-sans text-amber-200/70">
                <span>Comparaison avec v{activeVersion.versionNumber}</span>
                <span className="text-[10px] text-neutral-400">− supprimé · + ajouté</span>
              </div>
              <div className="space-y-1 p-3">
                {visibleDiffRows.map((row, idx) => {
                  const isRemoved = row.type === 'removed';
                  const isAdded = row.type === 'added';
                  const lineNumber = isRemoved ? row.leftLine : row.rightLine;
                  const marker = isRemoved ? '−' : isAdded ? '+' : ' ';
                  const value = isRemoved ? row.left : row.right;

                  return (
                    <div
                      key={`mobile-${idx}`}
                      className={`flex min-h-8 rounded px-2 py-1.5 ${
                        isRemoved
                          ? 'border-l-2 border-red-500 bg-red-950/50 text-red-200'
                          : isAdded
                            ? 'border-l-2 border-emerald-500 bg-emerald-950/50 text-emerald-200'
                            : 'border-l-2 border-transparent text-neutral-300'
                      }`}
                    >
                      <span className="w-9 shrink-0 select-none pr-2 text-right tabular-nums text-neutral-500">
                        {lineNumber ?? ''}
                      </span>
                      <span className={`w-5 shrink-0 select-none text-center font-bold ${
                        isRemoved ? 'text-red-400' : isAdded ? 'text-emerald-400' : 'text-transparent'
                      }`}>
                        {marker}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{value || ' '}</span>
                    </div>
                  );
                })}
                {diffGroups.rows.length === 0 && (
                  <p className="py-8 text-center font-sans text-neutral-400">Aucune différence détectée.</p>
                )}
              </div>
            </section>
          </main>
        ) : (
          <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0 w-full">
            {feedback && (
              <div role="status" className="rounded-xl border border-emerald-900/30 bg-emerald-950/30 px-4 py-3 font-sans text-sm text-emerald-300 print:hidden">
                {feedback}
              </div>
            )}

            {isReviewPreview ? (
              <div className="space-y-4">
                <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 font-sans text-sm text-emerald-200">Aperçu uniquement : la fiche n'est pas encore modifiée.</div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setIsReviewPreview(false)} className="touch-target w-full cursor-pointer rounded-xl border border-amber-900/40 px-4 py-2.5 font-sans text-sm text-amber-200 hover:bg-amber-900/20 sm:w-auto">Revenir aux changements</button>
                  <button type="button" onClick={handleApplyReview} disabled={isApplyingReview} className="touch-target w-full cursor-pointer rounded-xl bg-emerald-700 px-4 py-2.5 font-sans text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 sm:w-auto">{isApplyingReview ? 'Validation…' : 'Confirmer et appliquer'}</button>
                </div>
                {reviewPreviewCards.map((card, index) => (
                  <SheetCardItem
                    key={card.id}
                    card={card}
                    index={index}
                    total={reviewPreviewCards.length}
                    onMove={() => {}}
                    onDelete={() => {}}
                    onSaveDescription={async () => false}
                    onEditorChange={() => {}}
                    onCardUpdated={async () => {}}
                  />
                ))}
              </div>
            ) : (
              <>
                {mode === 'cards' && cards.length > 0 && !activeVersion && (
                  <div className="flex gap-2 print:hidden">
                    <button
                      onClick={openCreateCard}
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
                      onClick={openCreateCard}
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
                        onDelete={(target) => void deleteCard(target)}
                        onSaveDescription={saveCardDescription}
                        onEditorChange={registerEditor}
                        onCardUpdated={reload}
                      />
                    ))}
                  </div>
                ) : (
                  <SheetDocument sheet={sheet} category={category} cards={cards} />
                )}
              </>
            )}
          </main>
        )}
      </div>

      <SheetConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} sheet={sheet} cards={cards} onSuccess={() => void reload()} />
      <AttachNotesModal isOpen={isAttachOpen} sheet={sheet} cards={cards} onClose={() => setIsAttachOpen(false)} onAttached={reload} />

      {detectTargets && (
        <MentionDetection targets={detectTargets} sheets={allSheets} onClose={() => setDetectTargets(null)} />
      )}
    </div>
  );
}

export default SheetPage;