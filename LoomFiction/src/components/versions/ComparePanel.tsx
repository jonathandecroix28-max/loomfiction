import { useState, type ReactNode } from 'react';
import type { CompareMode } from '../../hooks/versions/useVersionCompare';
import { toggleBtn } from '../../utils/versions/versionStyles';

/* ───────────────────────── Panneau ───────────────────────── */

interface PanelProps {
  mode: CompareMode;
  onModeChange: (mode: CompareMode) => void;
  currentLeftLabel: string;
  children: ReactNode;
}

export function ComparePanel({ mode, onModeChange, currentLeftLabel, children }: PanelProps) {
  return (
    <section className="rounded-2xl sm:rounded-3xl border border-amber-900/25 bg-neutral-950/70 p-3 sm:p-6 shadow-xl space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-200/40 mb-1">Comparaison</p>
          <h2 className="text-xl sm:text-3xl font-bold text-amber-100">Comparer et fusionner</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:flex">
          <button onClick={() => onModeChange('current-left')} className={toggleBtn(mode === 'current-left')}>
            {currentLeftLabel}
          </button>
          <button onClick={() => onModeChange('version-left')} className={toggleBtn(mode === 'version-left')}>
            Version à gauche
          </button>
        </div>
      </div>

      {children}
    </section>
  );
}

export interface CardData {
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
      {/* Navigation par onglets (Uniquement sur mobile) */}
      <div className="md:hidden flex p-1 bg-neutral-900/80 rounded-lg border border-amber-900/30">
        {cards.map((card, idx) => (
          <button
            key={card.label}
            onClick={() => setMobileTab(idx)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              mobileTab === idx
                ? 'bg-amber-700 text-amber-50 shadow-sm'
                : 'text-amber-200/70 hover:text-amber-200'
            }`}
          >
            {card.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {cards.map((card, idx) => (
          <article
            key={card.label}
            className={`rounded-xl sm:rounded-2xl border border-amber-900/20 bg-neutral-950/60 p-3 sm:p-5 min-w-0 ${
              mobileTab === idx ? 'block' : 'hidden md:block'
            }`}
          >
            <div className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-amber-200/40 mb-2">{card.label}</div>
            <h3 className="text-lg sm:text-2xl font-bold text-amber-100 mb-2 wrap-break-word">{card.name}</h3>
            <div className={bodyClassName}>{renderBody(card.body)}</div>
          </article>
        ))}
      </div>
    </div>
  );
}