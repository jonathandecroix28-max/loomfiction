import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../themes/ThemeToggle';
import { IconClose } from '../icons';
import { NAV_ITEMS, isNavActive } from '../navItems';
import { useExplorerOpen } from '../../hooks/explorerOpenStore';


export function ExplorerNav({ onClose }: { onClose?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [, setIsOpen] = useExplorerOpen();

  const go = (path: string) => {
    navigate(path);
    if (window.innerWidth < 768) setIsOpen(false);
  };

  return (
    <nav
      aria-label="Navigation principale"
      className="flex shrink-0 items-center gap-1 border-b border-amber-900/40 bg-[var(--c-surface-2)] px-2 py-1.5"
    >
      <button
        type="button"
        onClick={() => go('/books')}
        aria-label="LoomFiction, retour à la bibliothèque"
        title="LoomFiction"
        className="mr-1 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-amber-800 font-serif text-lg font-bold text-amber-50 shadow-sm transition hover:bg-amber-700 sm:size-9"
      >
        L
      </button>

      {NAV_ITEMS.map(({ key, label, Icon, path }) => {
        const active = isNavActive(key, pathname);
        return (
          <button
            key={key}
            type="button"
            onClick={() => go(path)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            title={label}
            className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition sm:size-9 ${
              active
                ? 'border-amber-700 bg-amber-900/70 text-amber-100'
                : 'border-transparent text-amber-200/60 hover:bg-amber-950/60 hover:text-amber-100'
            }`}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        );
      })}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ThemeToggle />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Fermer l'explorateur (Échap)"
            aria-label="Fermer l'explorateur"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-amber-200/60 transition hover:bg-amber-900/30 hover:text-amber-100 sm:size-9"
          >
            <IconClose className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
}