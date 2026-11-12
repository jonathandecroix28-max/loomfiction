import { useEffect, useRef, useState, type ComponentType } from 'react';
import { IconMore } from '../../../components/icons';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function ActionMenu({ label, items, align = 'right', className = '' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="touch-target inline-flex min-w-11 cursor-pointer items-center justify-center rounded-xl border border-amber-900/30 bg-neutral-900 px-3 text-amber-200 transition hover:bg-neutral-800"
      >
        <IconMore className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-amber-900/40 bg-[#1c1411] p-1.5 font-sans shadow-2xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key}>
                {item.separatorBefore && <div className="my-1.5 border-t border-amber-900/30" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`touch-target flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    item.danger ? 'text-red-300 hover:bg-red-950/50' : 'text-amber-100 hover:bg-neutral-900'
                  }`}
                >
                  {Icon && <Icon className="size-4 shrink-0" />}
                  {item.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}