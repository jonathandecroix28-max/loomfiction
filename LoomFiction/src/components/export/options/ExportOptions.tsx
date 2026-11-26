import { labelClass, sectionClass } from '../../../utils/export/ui';

type Props = {
  author: string;
  onAuthor: (value: string) => void;
  titlePage: boolean;
  onTitlePage: (value: boolean) => void;
  chapterNumbers: boolean;
  onChapterNumbers: (value: boolean) => void;
  spacedParagraphs: boolean;
  onSpacedParagraphs: (value: boolean) => void;
};

export function ExportOptions({
  author,
  onAuthor,
  titlePage,
  onTitlePage,
  chapterNumbers,
  onChapterNumbers,
  spacedParagraphs,
  onSpacedParagraphs,
}: Props) {
  return (
    <section className={sectionClass}>
      <div>
        <label htmlFor="export-author" className={`${labelClass} mb-1.5`}>Auteur (facultatif)</label>
        <input
          id="export-author"
          value={author}
          onChange={(event) => onAuthor(event.target.value)}
          placeholder="Ton nom ou ton pseudo"
          className="w-full rounded-xl border border-amber-900/30 bg-neutral-900 px-4 py-2.5 text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-amber-200/80 cursor-pointer">
        <input type="checkbox" checked={titlePage} onChange={(event) => onTitlePage(event.target.checked)} />
        Ajouter une page de titre
      </label>

      <label className="flex items-center gap-2 text-sm text-amber-200/80 cursor-pointer">
        <input
          type="checkbox"
          checked={chapterNumbers}
          onChange={(event) => onChapterNumbers(event.target.checked)}
        />
        Afficher les numéros de chapitre
      </label>

      <label className="flex items-center gap-2 text-sm text-amber-200/80 cursor-pointer">
        <input
          type="checkbox"
          checked={spacedParagraphs}
          onChange={(event) => onSpacedParagraphs(event.target.checked)}
        />
        Espacer les paragraphes (sinon : retrait de première ligne)
      </label>
    </section>
  );
}