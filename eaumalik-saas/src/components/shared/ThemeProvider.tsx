'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';
interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);
const KEY = 'eaumalik_theme';

/**
 * ThemeProvider — gere le mode clair/sombre en synchronisation avec
 * - localStorage (persistance)
 * - data-theme="light|dark" sur <html> (variables CSS)
 * - class "dark" sur <html> (utilitaires Tailwind dark:)
 * - class "theme-transition" pour adoucir le changement de palette
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      setTheme(stored === 'light' ? 'light' : 'dark');
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    html.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(KEY, theme);
    } catch {}

    // Adoucit la transition de couleurs pendant ~400ms
    html.classList.add('theme-transition');
    const t = setTimeout(() => html.classList.remove('theme-transition'), 450);
    return () => clearTimeout(t);
  }, [theme, hydrated]);

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}