import { useNavigate, useLocation } from "react-router-dom";
import { IconMenu } from './icons';
import { useExplorerOpen } from '../hooks/explorerOpenStore';
import { explorerRouteInfo } from './explorer/explorerRoutes';
import { NAV_ITEMS, isNavActive, type NavKey } from './navItems';
import { ThemeToggle } from "./themes/ThemeToggle";

interface NavbarProps {
  collapsed?: boolean;
}

export function Navbar({ collapsed = false }: NavbarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [isExplorerOpen, setIsExplorerOpen] = useExplorerOpen();
  const hasExplorer = explorerRouteInfo(pathname).available;

  const active = Object.fromEntries(
    NAV_ITEMS.map((item) => [item.key, isNavActive(item.key, pathname)]),
  ) as Record<NavKey, boolean>;

  const ExplorerToggle = hasExplorer ? (
    <button
      type="button"
      onClick={() => setIsExplorerOpen(!isExplorerOpen)}
      aria-pressed={isExplorerOpen}
      aria-label={isExplorerOpen ? "Fermer l'explorateur" : "Ouvrir l'explorateur"}
      title={isExplorerOpen ? "Fermer l'explorateur" : "Ouvrir l'explorateur"}
      className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition ${
        isExplorerOpen
          ? "border-amber-700 bg-amber-900/70 text-amber-100"
          : "border-transparent text-amber-200/70 hover:bg-amber-950/60 hover:text-amber-100"
      }`}
    >
      <IconMenu size={20} strokeWidth={1.8} aria-hidden="true" />
    </button>
  ) : null;

  const Logo = (
    <button
      type="button"
      onClick={() => navigate("/books")}
      className="flex items-center gap-3 min-w-0 group cursor-pointer"
      aria-label="LoomFiction, retour à la bibliothèque"
    >
      <span className="w-9 h-9 rounded-xl bg-amber-800 text-amber-50 flex items-center justify-center font-serif font-bold text-lg shadow-sm group-hover:bg-amber-700 transition shrink-0">
        L
      </span>

      <span className="text-lg sm:text-xl font-serif font-bold text-amber-100 tracking-tight group-hover:text-amber-50 transition truncate">
        LoomFiction
      </span>
    </button>
  );

  return (
    <>
      {/* DESKTOP / TABLETTE : NAVIGATION EN HAUT   */}

      <header className={`${collapsed ? "hidden" : "hidden sm:block"} bg-[#1c1411] border-b border-amber-900/40 sticky top-0 z-50 shadow-md`}>
        <nav
          aria-label="Navigation principale"
          className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8"
        >
          <div className="flex min-w-0 items-center gap-2">
            {ExplorerToggle}
            {Logo}
          </div>

          <ul className="flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.Icon;

              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    aria-current={
                      active[item.key] ? "page" : undefined
                    }
                    className={`px-3.5 py-2 rounded-lg text-sm font-serif font-medium whitespace-nowrap border transition cursor-pointer flex items-center gap-2 ${
                      active[item.key]
                        ? "bg-amber-900/70 text-amber-100 border-amber-700"
                        : "bg-transparent text-amber-200/60 border-transparent hover:text-amber-100 hover:bg-amber-950/60"
                    }`}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.8}
                      className="shrink-0"
                      aria-hidden="true"
                    />

                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {/* MOBILE : BANDEAU SUPERIEUR                */}

      <header className="sm:hidden bg-[#1c1411] border-b border-amber-900/40 sticky top-0 z-40 shadow-md">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {ExplorerToggle}
            {Logo}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      
      {/* MOBILE : NAVIGATION FIXE EN BAS */}

    <nav
      aria-label="Navigation principale"
      className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-[#1c1411]/95 backdrop-blur border-t border-amber-900/40 shadow-[0_-4px_12px_rgba(0,0,0,0.25)] pb-[env(safe-area-inset-bottom)]"
    >
    <ul className="grid grid-cols-4">
    {NAV_ITEMS.map((item) => {
      const Icon = item.Icon;

      return (
        <li key={item.key}>
          <button
            type="button"
            onClick={() => navigate(item.path)}
            aria-label={item.label}
            aria-current={
              active[item.key] ? "page" : undefined
            }
            title={item.label}
            className={`relative w-full h-16 flex items-center justify-center transition cursor-pointer ${
              active[item.key]
                ? "text-amber-100"
                : "text-amber-200/50 active:text-amber-100"
            }`}
          >
            {/* Indicateur de page active */}
            {active[item.key] && (
              <span className="absolute top-0 h-0.5 w-8 rounded-b bg-amber-500" />
            )}

            {/* Icône Lucide */}
            <Icon
              size={25}
              strokeWidth={1.8}
              className="shrink-0"
              aria-hidden="true"
            />
          </button>
        </li>
      );
    })}
  </ul>
</nav>

    </>
  );
}