import { useState, useEffect } from 'react';
import { themeService } from '../../utils/theme/theme';
import type { ThemeMode } from '../../utils/theme/theme';
import { IconSunrise, IconSunset } from '../icons';

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(themeService.getTheme());

  useEffect(() => {
    themeService.setTheme(theme);
    if (theme === 'sunrise') {
      document.documentElement.classList.add('sunrise-mode');
    } else {
      document.documentElement.classList.remove('sunrise-mode');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'sunset' ? 'sunrise' : 'sunset'));
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'sunset' ? 'Passer au thème lever de soleil' : 'Passer au thème coucher de soleil'}
      className="text-xs px-3.5 py-2 rounded-xl border font-medium transition cursor-pointer flex items-center gap-2 shadow-xs bg-neutral-900 text-amber-200 border-amber-900/30 hover:bg-neutral-800"
      title="Changer l'ambiance (Lever ou Coucher de soleil)"
    >
      <span>{theme === 'sunset' ? <IconSunset className="size-4" aria-hidden="true" /> : <IconSunrise className="size-4" aria-hidden="true" />}</span>
      <span className="hidden sm:inline">{theme === 'sunset' ? 'Lever de soleil' : 'Coucher de soleil'}</span>
    </button>
  );
}