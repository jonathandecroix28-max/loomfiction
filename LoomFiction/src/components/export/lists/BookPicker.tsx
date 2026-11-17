import type { BookOption } from '../../../hooks/export/useExportBooks';
import { labelClass, sectionClass } from '../../../utils/export/ui';

type Props = {
  books: BookOption[];
  value: number | null;
  onChange: (bookId: string) => void;
};

export function BookPicker({ books, value, onChange }: Props) {
  return (
    <section className={sectionClass}>
      <label htmlFor="export-book" className={labelClass}>Roman</label>
      <select
        id="export-book"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-amber-900/30 bg-neutral-900 px-3 sm:px-4 py-2.5 sm:py-3 text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        {books.map((item) => (
          <option key={item.id} value={item.id}>{item.title}</option>
        ))}
      </select>
    </section>
  );
}