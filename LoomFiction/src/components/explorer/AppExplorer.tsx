import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChapterExplorer } from '../../modules/chapters/components/ChapterExplorer';
import { SheetExplorer } from '../../modules/sheets/components/SheetExplorer';
import { VersionsExplorer } from '../versions/VersionsExplorer';
import { IconBooks, IconHistory, IconSheet } from '../icons';
import { useExplorerOpen } from '../../hooks/explorerOpenStore';
import { getExplorerBridge, useExplorerBridgeSnapshot } from '../../hooks/explorerBridge';
import { ExplorerNav } from './ExplorerNav';
import { explorerRouteInfo, type ExplorerDomain } from './explorerRoutes';

const TABS: { key: ExplorerDomain; label: string; Icon: typeof IconBooks }[] = [
  { key: 'chapters', label: 'Romans', Icon: IconBooks },
  { key: 'sheets', label: 'Fiches', Icon: IconSheet },
  { key: 'versions', label: 'Versions', Icon: IconHistory },
];


export function AppExplorer() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useExplorerOpen();
  const bridge = useExplorerBridgeSnapshot();
  const info = explorerRouteInfo(pathname);

  const [tab, setTab] = useState<ExplorerDomain>(info.domain);
  const [lastDomain, setLastDomain] = useState<ExplorerDomain>(info.domain);
  if (info.domain !== lastDomain) {
    setLastDomain(info.domain);
    setTab(info.domain);
  }

  const close = useCallback(() => setIsOpen(false), [setIsOpen]);

  useEffect(() => {
    if (!isOpen || !info.available) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      window.setTimeout(() => {
        if (!event.defaultPrevented) close();
      }, 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, info.available, close]);

  if (!info.available) return null;

  const chaptersBookId = bridge.chapters?.bookId ?? info.bookId ?? 0;
  const currentChapterId = bridge.chapters?.currentChapterId ?? info.chapterId ?? 0;
  const currentSheetId = bridge.sheets?.currentSheetId ?? info.sheetId ?? null;
  const selectedVersionId = bridge.versions?.selectedVersionId ?? info.versionId ?? null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-[65] bg-[var(--c-overlay)] transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        aria-label="Explorateur"
        aria-hidden={!isOpen}
        className={`loom fixed inset-y-0 left-0 z-[70] flex w-[min(88vw,21rem)] shrink-0 flex-col border-r border-amber-900/40 bg-[var(--c-surface)] shadow-2xl transition-[transform,visibility] duration-300 ease-in-out md:sticky md:top-[var(--nav-top,0px)] md:bottom-auto md:left-auto md:z-40 md:h-[calc(100dvh-var(--nav-top,0px))] md:w-80 md:translate-x-0 md:self-start md:shadow-xl ${
          isOpen ? 'visible translate-x-0' : 'invisible pointer-events-none -translate-x-full md:hidden'
        }`}
      >
        <ExplorerNav onClose={close} />

        <div role="tablist" aria-label="Rubriques de l'explorateur" className="flex shrink-0 border-b border-amber-900/40 bg-[var(--c-surface-2)] font-sans">
          {TABS.map(({ key, label, Icon }) => {
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(key)}
                className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs transition-colors sm:min-h-10 ${
                  selected
                    ? 'border-amber-500 text-amber-100'
                    : 'border-transparent text-amber-200/60 hover:bg-neutral-800/60 hover:text-amber-100'
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <ChapterExplorer
            embedded
            isOpen={isOpen && tab === 'chapters'}
            onClose={close}
            bookId={chaptersBookId}
            currentChapterId={currentChapterId}
            onNavigate={(chapterId) => {
              const handler = getExplorerBridge().chapters?.onNavigate;
              if (handler) handler(chapterId);
              else navigate(`/books/${chaptersBookId}/chapters/${chapterId}`);
            }}
            onSelectVersion={(version, context) => {
              const handler = getExplorerBridge().chapters?.onSelectVersion;
              if (handler) handler(version, context);
              else navigate(`/books/${context.bookId}/chapters/${version.chapterId}/versions/${version.id}`, { replace: true });
            }}
          />

          <SheetExplorer
            embedded
            isOpen={isOpen && tab === 'sheets'}
            onClose={close}
            currentSheetId={currentSheetId}
            onSelectSheetVersion={(version) => {
              const handler = getExplorerBridge().sheets?.onSelectSheetVersion;
              if (handler) handler(version);
              else navigate(`/ideas/fiches/${version.sheetId}/versions/${version.id}`);
            }}
            onSelectIdeaVersion={(version) => {
              const handler = getExplorerBridge().sheets?.onSelectIdeaVersion;
              if (handler) handler(version);
              else navigate(`/ideas/${version.ideaId}/versions/${version.id}`);
            }}
          />

          <VersionsExplorer
            embedded
            isOpen={isOpen && tab === 'versions'}
            onClose={close}
            kind={info.versionKind}
            parentId={info.versionParentId}
            bookId={info.bookId}
            selectedVersionId={selectedVersionId}
          />
        </div>
      </aside>
    </>
  );
}