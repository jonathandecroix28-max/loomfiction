import { useEffect, useSyncExternalStore, type ComponentProps } from 'react';
import type { ChapterExplorer } from '../modules/chapters/components/ChapterExplorer';
import type { SheetExplorer } from '../modules/sheets/components/SheetExplorer';
import type { VersionsExplorer } from '../components/versions/VersionsExplorer';

type ChapterProps = ComponentProps<typeof ChapterExplorer>;
type SheetProps = ComponentProps<typeof SheetExplorer>;
type VersionsProps = ComponentProps<typeof VersionsExplorer>;

export interface ExplorerBridgeValue {
  chapters?: Partial<Pick<ChapterProps, 'bookId' | 'currentChapterId' | 'onNavigate' | 'onSelectVersion'>>;
  sheets?: Partial<Pick<SheetProps, 'currentSheetId' | 'onSelectSheetVersion' | 'onSelectIdeaVersion'>>;
  versions?: Partial<Pick<VersionsProps, 'selectedVersionId'>>;
}

const EMPTY: ExplorerBridgeValue = {};

let current: ExplorerBridgeValue = EMPTY;
let snapshot: ExplorerBridgeValue = EMPTY;
let snapshotKey = '{}';
const listeners = new Set<() => void>();

const keyOf = (value: ExplorerBridgeValue) => JSON.stringify(value, (_key, item) => (typeof item === 'function' ? true : item));

function publish(next: ExplorerBridgeValue) {
  current = next;
  const key = keyOf(next);
  if (key === snapshotKey) return;
  snapshotKey = key;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getExplorerBridge = () => current;

export function useExplorerBridgeSnapshot(): ExplorerBridgeValue {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

export function useExplorerBridge<K extends keyof ExplorerBridgeValue>(
  section: K,
  value: NonNullable<ExplorerBridgeValue[K]>,
) {
  useEffect(() => {
    publish({ ...current, [section]: value });
  });

  useEffect(
    () => () => {
      const next = { ...current };
      delete next[section];
      publish(next);
    },
    [section],
  );
}

export function ExplorerBridge<K extends keyof ExplorerBridgeValue>({
  section,
  value,
}: {
  section: K;
  value: NonNullable<ExplorerBridgeValue[K]>;
}) {
  useExplorerBridge(section, value);
  return null;
}