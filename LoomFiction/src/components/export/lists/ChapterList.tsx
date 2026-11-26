// components/ChapterList.tsx
import type { ExportBook } from '../../../services/exportService';
import { labelClass, sectionClass, smallBtn } from '../../../utils/export/ui';
import { plural } from '../../../utils/export/text';

type Props = {
  book: ExportBook | null;
  loading: boolean;
  selected: Set<number>;
  count: number;
  totalWords: number;
  onToggle: (i: number) => void;
  onAll: () => void;
  onNone: () => void;
};

export function ChapterList({ book, loading, selected, count, totalWords, onToggle, onAll, onNone }: Props) {
  const hasChapters = !!book && book.chapters.length > 0;
  return (
    <section className={sectionClass}>
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>Chapitres</span>
        <div className="flex gap-2">
          <button type="button" onClick={onAll} className={smallBtn}>Tous</button>
          <button type="button" onClick={onNone} className={smallBtn}>Aucun</button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-amber-200/50 py-4">Chargement des chapitres...</p>
      ) : !hasChapters ? (
        <p className="text-sm text-amber-200/50 py-4">Ce roman ne contient aucun chapitre.</p>
      ) : (
        <ul className="max-h-60 overflow-y-auto rounded-xl border border-amber-900/20 divide-y divide-amber-900/10">
          {book.chapters.map((chapter, index) => (
            <li key={`${chapter.number}-${index}`}>
              <label className="flex items-center gap-3 px-3 py-2.5 text-sm text-amber-100/90 cursor-pointer hover:bg-neutral-900/50">
                <input type="checkbox" checked={selected.has(index)} onChange={() => onToggle(index)} />
                <span className="text-amber-200/40 shrink-0">{chapter.number}.</span>
                <span className="truncate">{chapter.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {hasChapters && (
        <p className="text-xs text-amber-200/50">
          {count} {plural(count, 'chapitre')} {plural(count, 'sélectionné')} · {totalWords.toLocaleString('fr-FR')} mots
        </p>
      )}
    </section>
  );
}