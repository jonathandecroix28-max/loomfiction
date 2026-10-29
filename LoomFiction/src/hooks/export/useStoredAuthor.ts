import { useState } from 'react';

const AUTHOR_KEY = 'plotweaver:export-author';

export function useStoredAuthor() {
  const [author, setAuthor] = useState(() => {
    try { return localStorage.getItem(AUTHOR_KEY) ?? ''; } catch { return ''; }
  });
  const remember = () => {
    try { localStorage.setItem(AUTHOR_KEY, author.trim()); } catch { /* stockage indisponible */ }
  };
  return { author, setAuthor, remember };
}