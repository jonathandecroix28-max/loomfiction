import { useEffect, useState } from 'react';
import { copyBookToClipboard, exportBook, EXPORT_FORMATS, type ExportBook, type ExportFormat } from '../../services/exportService';

export type Status = { type: 'ok' | 'error'; text: string } | null;

type Args = {
  book: ExportBook | null;
  chapters: ExportBook['chapters'];
  author: string;
  remember: () => void;
  format: ExportFormat;
  options: { titlePage: boolean; chapterNumbers: boolean };
  canAct: boolean;
};

export function useExportActions({ book, chapters, author, remember, format, options, canAct }: Args) {
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => setStatus(null), [book]);

  const payload = (): ExportBook => ({ ...(book as ExportBook), author: author.trim() || undefined, chapters });

  const run = async (
    setFlag: (v: boolean) => void,
    task: () => Promise<void>,
    failure: string,
    logLabel: string
  ) => {
    if (!canAct) return;
    setFlag(true);
    setStatus(null);
    try {
      remember();
      await task();
    } catch (error) {
      console.error(logLabel, error);
      setStatus({ type: 'error', text: failure });
    } finally {
      setFlag(false);
      setProgress(null);
    }
  };

  const doExport = () =>
    run(setBusy, async () => {
      await exportBook(payload(), format, options, (done, total) => setProgress({ done, total }));
      setStatus({ type: 'ok', text: EXPORT_FORMATS.find((f) => f.key === format)?.done ?? 'Export terminé.' });
    }, 'L’export a échoué. Réessaie dans un instant.', 'Erreur lors de l’export :');

  const doCopy = () =>
    run(setCopying, async () => {
      const mode = await copyBookToClipboard(payload(), options);
      setStatus({
        type: 'ok',
        text: mode === 'rich'
          ? 'Texte copié avec sa mise en forme : colle-le dans Word, Google Docs, Notion ou un éditeur de blog.'
          : 'Texte copié (sans mise en forme, ton navigateur ne la permet pas).',
      });
    }, 'Copie impossible. Autorise l’accès au presse-papiers ou utilise un export.', 'Erreur lors de la copie :');

  return { busy, copying, progress, status, doExport, doCopy };
}