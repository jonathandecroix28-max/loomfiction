import { smallBtn } from '../../../utils/export/ui';
import { IconMoon, IconSun } from '../../icons';

type Props = { dark: boolean; onSmaller: () => void; onBigger: () => void; onToggleDark: () => void };

export function PreviewControls({ dark, onSmaller, onBigger, onToggleDark }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onSmaller} aria-label="Réduire la taille du texte" className={smallBtn}>A−</button>
      <button type="button" onClick={onBigger} aria-label="Agrandir la taille du texte" className={smallBtn}>A+</button>
      <button type="button" onClick={onToggleDark} aria-label={dark ? 'Papier clair' : 'Papier sombre'} className={smallBtn}>
        {dark ? <IconSun className="size-4" aria-hidden="true" /> : <IconMoon className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}