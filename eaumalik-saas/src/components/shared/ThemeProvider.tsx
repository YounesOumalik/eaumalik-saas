'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';
interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  /** false = l'utilisateur n'a pas encore choisi, on suit le système. */
  hasUserPreference: boolean;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);
const KEY = 'eaumalik_theme';

/**
 * ThemeProvider — gère le mode clair/sombre en synchronisation avec :
 *  - localStorage (persistance du choix explicite de l'utilisateur)
 *  - data-theme="light|dark" sur <html> (variables CSS sémantiques)
 *  - class "dark" sur <html> (utilitaires Tailwind dark:)
 *  - class "theme-transition" pour adoucir le changement de palette
 *
 * Mode "auto" (par défaut) : tant que l'utilisateur n'a pas choisi, on suit
 * `prefers-color-scheme`. Dès qu'il toggle une fois, son choix est mémorisé.
 * Un script inline anti-flash dans `layout.tsx` pose déjà `data-theme` avant
 * le premier paint pour éviter le flash blanc/noir à l'ouverture.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [hydrated, setHydrated] = useState(false);
  const [hasUserPreference, setHasUserPreference] = useState(false);

  // Hydratation : préférence stockée > prefers-color-scheme > sombre.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
        setHasUserPreference(true);
      } else {
        const prefersLight =
          typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: light)').matches;
        setTheme(prefersLight ? 'light' : 'dark');
        setHasUserPreference(false);
      }
    } catch {
      setTheme('dark');
    }
    setHydrated(true);
  }, []);

  // Pose l'attribut sur <html> à chaque changement.
  useEffect(() => {
    if (!hydrated) return;
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    html.classList.toggle('dark', theme === 'dark');
    try {
      if (hasUserPreference) localStorage.setItem(KEY, theme);
    } catch {}

    // Adoucit la transition de couleurs pendant ~400ms.
    html.classList.add('theme-transition');
    const t = setTimeout(() => html.classList.remove('theme-transition'), 450);
    return () => clearTimeout(t);
  }, [theme, hydrated, hasUserPreference]);

  const toggle = () => {
    setHasUserPreference(true);
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, hasUserPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}