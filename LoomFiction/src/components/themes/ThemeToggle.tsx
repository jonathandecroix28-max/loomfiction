import { useState, useEffect } from 'react';
import { themeService } from '../../utils/theme/theme';
import type { ThemeMode } from '../../utils/theme/theme';
import { IconSunrise, IconSunset } from '../icons';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
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

  const label =
    theme === 'sunset'
      ? 'Passer au thème lever de soleil'
      : 'Passer au thème coucher de soleil';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-amber-200/60 transition hover:bg-amber-950/60 hover:text-amber-100 sm:size-9 ${className}`}
    >
      {theme === 'sunset' ? (
        <IconSunset size={18} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <IconSunrise size={18} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}