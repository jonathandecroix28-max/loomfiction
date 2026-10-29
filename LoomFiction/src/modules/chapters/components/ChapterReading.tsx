import { memo, useMemo, type ReactNode } from 'react';
import DOMPurify from 'dompurify';


export const READING_COLUMN = 'w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16';

export function ChapterHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif text-amber-100 mb-10 text-center tracking-tight">
      {children}
    </h1>
  );
}

export const ChapterContent = memo(function ChapterContent({ html }: { html: string }) {
  const clean = useMemo(() => DOMPurify.sanitize(html), [html]);
  return (
    <div
      className="prose prose-invert max-w-none text-lg leading-relaxed text-amber-100/90 font-serif mb-16"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
});