import { useState, type ReactNode } from 'react';
import type { CompareMode } from '../../hooks/versions/useVersionCompare';
import '../diff/diff.css';

/* ───────────────────────── Panneau ───────────────────────── */

interface PanelProps {
  mode: CompareMode;
  onModeChange: (mode: CompareMode) => void;
  currentLeftLabel: string;
  versionLeftLabel?: string;
  children: ReactNode;
}

export function ComparePanel({
  mode,
  onModeChange,
  currentLeftLabel,
  versionLeftLabel = 'Version à gauche',
  children,
}: PanelProps) {
  return (
    <section className="loom space-y-4 rounded-2xl border border-amber-900/25 bg-neutral-950/70 p-3 shadow-xl sm:space-y-6 sm:rounded-3xl sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.28em] text-amber-200/40 sm:text-xs">Comparaison</p>
          <h2 className="text-xl font-bold text-amber-100 sm:text-3xl">Comparer et fusionner</h2>
        </div>

        <div className="flex flex-col gap-1.5 font-sans">
          <span className="text-[11px] text-amber-200/60">Colonne de gauche</span>
          <div className="ld-seg" role="group" aria-label="Colonne de gauche">
            <button
              type="button"
              className="flex-1"
              aria-pressed={mode === 'current-left'}
              onClick={() => onModeChange('current-left')}
            >
              {currentLeftLabel}
            </button>
            <button
              type="button"
              className="flex-1"
              aria-pressed={mode === 'version-left'}
              onClick={() => onModeChange('version-left')}
            >
              {versionLeftLabel}
            </button>
          </div>
        </div>
      </div>

      {children}
    </section>
  );
}

export interface CardData {
  tone?: 'add' | 'del';
  label: string;
  name: string;
  body: string;
}

interface CardsProps {
  mode: CompareMode;
  current: CardData;
  version: CardData;
  renderBody: (body: string) => ReactNode;
  bodyClassName: string;
}

export function CompareCards({ mode, current, version, renderBody, bodyClassName }: CardsProps) {
  const cards = mode === 'current-left' ? [current, version] : [version, current];
  const [mobileTab, setMobileTab] = useState(0);

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Navigation par onglets (mobile uniquement) */}
      <div className="ld-seg flex md:hidden" role="tablist">
        {cards.map((card, idx) => (
          <button
            key={card.label}
            type="button"
            role="tab"
            aria-selected={mobileTab === idx}
            aria-pressed={mobileTab === idx}
            onClick={() => setMobileTab(idx)}
            className="flex-1"
          >
            {card.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {cards.map((card, idx) => (
          <article
            key={card.label}
            className={`ld-sheet ${card.tone ? `ld-sheet-${card.tone}` : 'ld-sheet-neutral'} p-3 sm:p-5 ${
              mobileTab === idx ? 'block' : 'hidden md:block'
            }`}
          >
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-amber-200/40 sm:text-xs">{card.label}</div>
            <h3 className="mb-2 wrap-break-word text-lg font-bold text-amber-100 sm:text-2xl">{card.name}</h3>
            <div className={bodyClassName}>{renderBody(card.body)}</div>
          </article>
        ))}
      </div>
    </div>
  );
}