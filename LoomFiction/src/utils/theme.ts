export type ThemeMode = 'sunrise' | 'sunset';

export const themeService = {
  getTheme(): ThemeMode {
    const saved = localStorage.getItem('loomfiction_theme');
    return (saved === 'sunrise' || saved === 'sunset') ? saved : 'sunset';
  },

  setTheme(theme: ThemeMode) {
    localStorage.setItem('loomfiction_theme', theme);
  }
};