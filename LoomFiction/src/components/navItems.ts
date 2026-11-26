import { IconBooks, IconExport, IconHistory, IconIdea, type LucideIcon } from './icons';

export type NavKey = 'books' | 'ideas' | 'versions' | 'export';

export const NAV_ITEMS: {
  key: NavKey;
  label: string;
  short: string;
  Icon: LucideIcon;
  path: string;
}[] = [
  { key: 'books', label: 'Romans', short: 'Romans', Icon: IconBooks, path: '/books' },
  { key: 'ideas', label: "Carnet d'idées", short: 'Idées', Icon: IconIdea, path: '/ideas' },
  { key: 'versions', label: 'Versions', short: 'Versions', Icon: IconHistory, path: '/versions' },
  { key: 'export', label: 'Exporter', short: 'Export', Icon: IconExport, path: '/export' },
];


export function isNavActive(key: NavKey, pathname: string): boolean {
  switch (key) {
    case 'versions':
      return pathname === '/versions';
    case 'export':
      return pathname.startsWith('/export');
    case 'ideas':
      return pathname.startsWith('/ideas');
    case 'books':
      return pathname.startsWith('/books') || pathname === '/';
  }
}