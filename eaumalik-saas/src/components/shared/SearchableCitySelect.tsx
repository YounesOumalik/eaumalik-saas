'use client';

import { useState, useRef, useEffect } from 'react';

export const MOROCCAN_CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tanger', 'Agadir', 'Meknes', 'Oujda', 'Kenitra', 'Tetouan', 
  'Safi', 'Temara', 'Inezgane', 'Mohammedia', 'Laayoune', 'Khouribga', 'Beni Mellal', 'Jorf Lasfar', 'El Jadida', 
  'Nador', 'Taza', 'Settat', 'Larache', 'Ksar El Kebir', 'Khemisset', 'Guelmim', 'Berrechid', 'Wad Zem', 
  'Fqih Ben Salah', 'Taourirt', 'Sidi Slimane', 'Sidi Kacem', 'Khenifra', 'Taroudant', 'Essaouira', 'Tiznit', 
  'Ouarzazate', 'Youssoufia', 'Sefrou', 'Fnideq', 'Martil', 'Errachidia', 'Chefchaouen', 'Asilah', 
  'Azrou', 'Midelt', 'Tinghir', 'Zagora', 'Sidi Ifni', 'Al Hoceima', 'Boujdour', 'Tan-Tan', 'Mrirt',
  'Ouezzane', 'Berkane', 'Taounate', 'Imzouren', 'Sidi Bennour', 'Skhirat', 'Jerada', 'Targuist', 'Ahfir',
  'El Hajeb', 'Bouznika', 'Sidi Yahya El Gharb', 'Zaio', 'Kelaat Sraghna', 'Guercif', 'Demnate', 'Oulad Teima'
].sort((a, b) => a.localeCompare(b, 'fr'));

interface SearchableCitySelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function SearchableCitySelect({
  id,
  name,
  value,
  onChange,
  placeholder = 'Choisir une ville',
  required = false,
}: SearchableCitySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch(value);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filtered = MOROCCAN_CITIES.filter(c =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="hidden"
        id={id}
        name={name}
        value={value}
      />
      <input
        type="text"
        className="form-input pr-10 text-sm"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setIsOpen(true);
          const match = MOROCCAN_CITIES.find(c => c.toLowerCase() === e.target.value.toLowerCase());
          if (match) {
            onChange(match);
          } else if (e.target.value === '') {
            onChange('');
          }
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-[10px]`} />
      </div>
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-2xl z-[1000] p-1 space-y-0.5">
          {filtered.length > 0 ? (
            filtered.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setSearch(c);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors hover:bg-[color:var(--bg-card-hover)] text-[color:var(--text-secondary)] hover:text-[color:var(--primary-light)] font-medium"
              >
                {c}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Aucune ville trouvée
            </div>
          )}
        </div>
      )}
    </div>
  );
}
