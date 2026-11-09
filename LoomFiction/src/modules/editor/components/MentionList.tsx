import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SheetResponse } from '../../../types/sheet';

export interface MentionListProps {
  items: SheetResponse[];
  command: (item: { id: number; label: string }) => void;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) command({ id: item.id, label: item.name });
    };

    const upHandler = () => {
      if (items.length === 0) return;
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    };

    const downHandler = () => {
      if (items.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % items.length);
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }
        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="w-full rounded-xl border border-amber-900/40 bg-[#1c1411] px-4 py-3 font-serif text-sm text-amber-200/60 shadow-xl sm:w-56 sm:text-xs">
          Aucune fiche trouvée
        </div>
      );
    }

    return (
      <div className="max-h-[min(45vh,20rem)] w-full overflow-y-auto overscroll-contain rounded-xl border border-amber-900/40 bg-[#1c1411] p-2 font-serif shadow-2xl backdrop-blur-md sm:max-h-48 sm:w-56 sm:p-1">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200/40 sm:hidden">
          Sélectionner une fiche
        </p>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}
            className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors sm:min-h-0 sm:gap-2 sm:py-2 sm:text-xs ${
              index === selectedIndex
                ? 'bg-amber-800/60 font-medium text-amber-100'
                : 'text-amber-200/80 hover:bg-neutral-900'
            }`}
          >
            <span className="size-2 shrink-0 rounded-full bg-amber-500" />
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = 'MentionList';
