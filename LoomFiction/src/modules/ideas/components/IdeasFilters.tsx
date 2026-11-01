import { useState } from "react";
import {
  IconBook,
  IconChevronDown,
  IconClose,
  IconFilters,
  IconSearch,
} from '../../../components/icons';

import type { IdeaStatus } from "../../../types/idea";
import type { BookResponse } from "../../../types/book";

interface IdeasFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;

  bookFilter: string;
  onBookFilterChange: (val: string) => void;

  statusFilter: IdeaStatus | "all";
  onStatusFilterChange: (val: IdeaStatus | "all") => void;

  books: BookResponse[];
}

export function IdeasFilters({
  search,
  onSearchChange,
  bookFilter,
  onBookFilterChange,
  statusFilter,
  onStatusFilterChange,
  books,
}: IdeasFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilters =
    Number(bookFilter !== "") +
    Number(statusFilter !== "all");

  return (
    <div className="mb-6 space-y-3">

      {/* RECHERCHE PRINCIPALE */}
      <div className="relative w-full">
        <IconSearch
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
          aria-hidden="true"
        />

        <input
          type="text"
          placeholder="Rechercher dans les notes et les fiches..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Rechercher dans les idées"
          className="w-full bg-neutral-900 border border-amber-900/40 rounded-xl pl-11 pr-4 py-3 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif placeholder:text-amber-200/30"
        />
      </div>

      {/* DESKTOP : FILTRES SOUS LA RECHERCHE */}
      <div className="hidden sm:flex items-center gap-3 max-w-2xl">

        {/* FILTRE ROMAN */}
        <div className="relative flex-1 min-w-0">
          <IconBook
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
            aria-hidden="true"
          />

          <select
            value={bookFilter}
            onChange={(e) => onBookFilterChange(e.target.value)}
            aria-label="Filtrer par roman"
            className="w-full appearance-none bg-neutral-900 border border-amber-900/40 rounded-xl pl-10 pr-9 py-3 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif cursor-pointer touch-target"
          >
            <option value="">Tous les romans</option>

            {books.map((book) => (
              <option key={book.id} value={book.title}>
                {book.title}
              </option>
            ))}
          </select>

          <IconChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
            aria-hidden="true"
          />
        </div>

        {/* FILTRE STATUT */}
        <div className="relative flex-1 min-w-0">
          <IconFilters
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
            aria-hidden="true"
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(
                e.target.value as IdeaStatus | "all"
              )
            }
            aria-label="Filtrer par statut"
            className="w-full appearance-none bg-neutral-900 border border-amber-900/40 rounded-xl pl-10 pr-9 py-3 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif cursor-pointer touch-target"
          >
            <option value="all">Tous les statuts</option>
            <option value="draft">Brutes</option>
            <option value="in-progress">En cours</option>
            <option value="integrated">Intégrées</option>
          </select>

          <IconChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* MOBILE : BOUTON FILTRES */}
      <div className="sm:hidden">

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="ideas-mobile-filters"
          className="w-full flex items-center justify-between gap-3 bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-3 text-sm text-amber-100 font-serif hover:bg-amber-950/40 transition"
        >
          <span className="flex items-center gap-2">
            <IconFilters className="size-4" aria-hidden="true" />
            Filtres

            {activeFilters > 0 && (
              <span className="flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-800 text-amber-100 text-xs">
                {activeFilters}
              </span>
            )}
          </span>

          <IconChevronDown
            className={`size-4 text-amber-200/60 transition-transform ${
              filtersOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {/* PANNEAU MOBILE */}
        {filtersOpen && (
          <div
            id="ideas-mobile-filters"
            className="mt-3 p-3 bg-neutral-900/80 border border-amber-900/40 rounded-xl space-y-3"
          >

            {/* FILTRE ROMAN */}
            <div className="relative">
              <IconBook
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
                aria-hidden="true"
              />

              <select
                value={bookFilter}
                onChange={(e) => onBookFilterChange(e.target.value)}
                aria-label="Filtrer par roman"
                className="w-full appearance-none bg-neutral-950 border border-amber-900/40 rounded-xl pl-10 pr-9 py-3 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif cursor-pointer touch-target"
              >
                <option value="">Tous les romans</option>

                {books.map((book) => (
                  <option key={book.id} value={book.title}>
                    {book.title}
                  </option>
                ))}
              </select>

              <IconChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
                aria-hidden="true"
              />
            </div>

            {/* FILTRE STATUT */}
            <div className="relative">
              <IconFilters
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
                aria-hidden="true"
              />

              <select
                value={statusFilter}
                onChange={(e) =>
                  onStatusFilterChange(
                    e.target.value as IdeaStatus | "all"
                  )
                }
                aria-label="Filtrer par statut"
                className="w-full appearance-none bg-neutral-950 border border-amber-900/40 rounded-xl pl-10 pr-9 py-3 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif cursor-pointer touch-target"
              >
                <option value="all">Tous les statuts</option>
                <option value="draft">Brutes</option>
                <option value="in-progress">En cours</option>
                <option value="integrated">Intégrées</option>
              </select>

              <IconChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-amber-200/40"
                aria-hidden="true"
              />
            </div>

            {/* RÉINITIALISATION */}
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  onBookFilterChange("");
                  onStatusFilterChange("all");
                }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-amber-200/60 hover:text-amber-100 transition"
              >
                <IconClose className="size-3.5" aria-hidden="true" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
