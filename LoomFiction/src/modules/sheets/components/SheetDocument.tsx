import type { CategoryResponse } from '../../../types/category';
import type { IdeaResponse } from '../../../types/idea';
import type { SheetResponse } from '../../../types/sheet';

interface SheetDocumentProps {
  sheet: SheetResponse;
  category: CategoryResponse | null;
  cards: IdeaResponse[];
}

export function SheetDocument({
  sheet,
  category,
  cards,
}: SheetDocumentProps) {
  const completedCards = cards.filter(
    (card) => card.description?.trim()
  );

  return (
    <article className="
      sheet-document mx-auto max-w-4xl
      overflow-hidden rounded-2xl
      border border-amber-900/25
      bg-neutral-950 text-neutral-100
      shadow-xl
      print:max-w-none print:overflow-visible
      print:rounded-none print:border-0
      print:bg-white print:text-neutral-900
      print:shadow-none
    ">
      {/* En-tête */}
      <header className="
        relative border-b border-amber-900/30
        bg-gradient-to-br from-neutral-900 to-neutral-950
        px-7 py-10 text-center
        sm:px-12 sm:py-14
        print:border-b-2 print:border-neutral-800
        print:bg-white print:px-0 print:py-6
      ">
        <p className="
          mb-4 text-xs font-semibold uppercase
          tracking-[0.3em] text-amber-500
          print:text-neutral-500
        ">
          LoomFiction · Fiche de référence
        </p>

        <h1 className="
          font-serif text-3xl font-bold leading-tight
          text-amber-100 sm:text-5xl
          print:text-4xl print:text-neutral-900
        ">
          {sheet.name}
        </h1>

        {category && (
          <div className="mt-5 flex justify-center">
            <span
              className="
                rounded-full border px-4 py-1.5
                text-sm font-medium
                print:border-neutral-300 print:text-neutral-700
              "
              style={{
                borderColor: category.color,
                color: category.color,
              }}
            >
              {category.name}
            </span>
          </div>
        )}

        <p className="
          mt-5 text-xs text-neutral-500
          print:text-neutral-500
        ">
          {completedCards.length} caractéristique
          {completedCards.length > 1 ? 's' : ''}
        </p>
      </header>

      {/* Contenu */}
      <div className="
        space-y-5 p-6 sm:p-10
        print:space-y-0 print:px-0 print:py-5
      ">
        {completedCards.length === 0 ? (
          <p className="py-8 text-center italic text-neutral-500 print:hidden">
            Aucune caractéristique renseignée pour le moment.
          </p>
        ) : (
          completedCards.map((card, index) => (
            <section
              key={card.id}
              className="
                sheet-characteristic
                break-inside-avoid
                rounded-xl border border-neutral-800
                bg-neutral-900/60 p-5
                print:rounded-none print:border-0
                print:border-b print:border-neutral-200
                print:bg-white print:px-0 print:py-5
              "
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="
                  mt-0.5 flex h-7 w-7 shrink-0
                  items-center justify-center rounded-full
                  bg-amber-700/20 text-xs font-bold
                  text-amber-400
                  print:bg-neutral-100 print:text-neutral-600
                ">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <h2 className="
                  font-serif text-xl font-bold leading-snug
                  text-amber-200
                  print:text-lg print:text-neutral-900
                ">
                  {card.name}
                </h2>
              </div>

              <div className="
                whitespace-pre-wrap break-words pl-10
                font-serif text-[15px] leading-7
                text-amber-200/80
                print:pl-10 print:text-[11pt]
                print:leading-relaxed print:text-neutral-800
              ">
                {card.description}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Pied de page */}
      <footer className="
        flex items-center justify-between
        border-t border-neutral-800 px-6 py-4
        text-xs text-neutral-500
        print:mt-4 print:border-neutral-200
        print:px-0 print:py-3
      ">
        <span>LoomFiction</span>
        <span>Document de travail</span>
      </footer>
    </article>
  );
}