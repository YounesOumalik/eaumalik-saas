'use client';

import { useTheme } from './ThemeProvider';

/**
 * Toggle clair/sombre aligne sur la charte commune.
 * - Mode sombre : icone lune, animation tilt
 * - Mode clair  : icone soleil, animation rotation
 * - Background teal degrade, glow au hover
 */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className="relative min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 group"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px var(--primary-glow)',
      }}
    >
      <span
        className="relative w-full h-full flex items-center justify-center"
        style={{ color: 'var(--primary-light)' }}
      >
        {/* Lune (mode sombre actif) */}
        <i
          className={`fa-solid fa-moon text-sm absolute transition-all duration-500 ${
            isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
          }`}
          style={{ animation: isDark ? 'moonTilt 4s ease-in-out infinite' : 'none' }}
          aria-hidden="true"
        />
        {/* Soleil (mode clair actif) */}
        <i
          className={`fa-solid fa-sun text-sm absolute transition-all duration-500 ${
            !isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
          }`}
          style={{ animation: !isDark ? 'sunRotate 12s linear infinite' : 'none' }}
          aria-hidden="true"
        />
      </span>

      {/* Halo teal au hover */}
      <span
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: '0 0 0 2px var(--primary), inset 0 0 12px var(--primary-glow)' }}
      />
    </button>
  );
}