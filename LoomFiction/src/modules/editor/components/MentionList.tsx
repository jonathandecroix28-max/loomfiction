import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const [prevItems, setPrevItems] = useState(items);
    if (items !== prevItems) {
      setPrevItems(items);
      setSelectedIndex(0);
    }

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
      const list = listRef.current;
      const item = itemRefs.current[selectedIndex];
      if (!list || !item) return;
      const top = item.offsetTop;
      const bottom = top + item.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }, [selectedIndex]);

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
        <div className="w-full max-w-[calc(100vw-1rem)] rounded-xl border border-amber-900/40 bg-neutral-950 px-4 py-3 font-serif text-sm text-amber-200/60 shadow-xl sm:w-56 sm:text-xs">
          Aucune fiche trouvée
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        onMouseDown={(event) => event.preventDefault()}
        className="relative max-h-[min(40dvh,18rem)] w-full max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-amber-900/40 bg-neutral-950 p-2 font-serif shadow-2xl backdrop-blur-md sm:max-h-48 sm:w-56 sm:p-1"
      >
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200/40 sm:hidden">
          Sélectionner une fiche
        </p>
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            type="button"
            onClick={() => selectItem(index)}
            className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors sm:min-h-0 sm:gap-2 sm:py-2 sm:text-xs ${
              index === selectedIndex
                ? 'bg-amber-900/60 font-medium text-amber-100'
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