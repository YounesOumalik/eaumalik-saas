-- ============================================================================
-- EAUMALIK — Données de seed (catalogue démo + utilisateurs + commandes)
-- ============================================================================

INSERT INTO products (name, slug, description, price, category, image_url, specs, is_featured, stock, stock_alert_threshold, filter_lifespan_months)
VALUES
  ('ECO LIFE Purificateur d''Eau',         'eco-life-purificateur',
   'Purificateur d''eau haute performance avec systeme de filtration a 6 etapes.',
   1999, 'purificateurs', 'https://picsum.photos/seed/ecolife2025/400/400',
   '["Debit: 75 GPD","6 etapes de filtration","Reservoir 10L","Tension: 220V","Garantie 1 an"]'::jsonb,
   true, 15, 5, NULL),

  ('GIZA Purificateur Osmose Inverse',     'giza-osmose-inverse',
   'Purificateur a osmose inverse avec technologie avancee. Eau pure et saine garantie.',
   1999, 'purificateurs', 'https://picsum.photos/seed/giza2025/400/400',
   '["Debit: 75 GPD","Osmose inverse","6 etapes de filtration","Garantie 1 an","Design compact"]'::jsonb,
   true, 8, 5, NULL),

  ('OSMOSEUR COMPACT PREMIUM',             'osmoseur-compact-premium',
   'Osmoseur compact haut de gamme avec 7 etapes de filtration.',
   1999, 'purificateurs', 'https://picsum.photos/seed/osmoprem/400/400',
   '["Debit: 75 GPD","7 etapes de filtration","Elimination 99% impuretes","Design premium rouge"]'::jsonb,
   true, 12, 5, NULL),

  ('Station Osmose Inverse Industrielle',  'station-osmose-industrielle',
   'Station de traitement d''eau industrielle par osmose inverse.',
   24999, 'industriel', 'https://picsum.photos/seed/industriel2025/400/400',
   '["Debit: 400 GPD","Industrielle","Elimination 99%","Panneau controle","Installation sur site"]'::jsonb,
   false, 3, 2, NULL),

  ('Filtre PP 5 microns',                  'filtre-pp-5um',
   'Cartouche de filtration sedimentaire PP 5 microns.',
   49, 'consommables', 'https://picsum.photos/seed/filterpp25/400/400',
   '["Taille: 10 pouces","Finesse: 5um","Duree de vie: 6 mois","Tous modeles"]'::jsonb,
   false, 50, 10, 6),

  ('Filtre GAC (Charbon Actif)',           'filtre-gac',
   'Cartouche GAC pour elimination du chlore, odeurs et composes organiques.',
   59, 'consommables', 'https://picsum.photos/seed/filtergac25/400/400',
   '["Taille: 10 pouces","Charbon actif","Duree: 12 mois","Tous modeles"]'::jsonb,
   false, 45, 10, 12),

  ('Membrane d''Osmose 75 GPD',            'membrane-osmose-75gpd',
   'Membrane d''osmose inverse 75 gallons par jour.',
   299, 'consommables', 'https://picsum.photos/seed/membrane75/400/400',
   '["Debit: 75 GPD","Rejet: 98%","Duree: 24 mois","Standard"]'::jsonb,
   false, 20, 5, 24),

  ('Filtre Post-Carbone T33',              'filtre-post-carbone-t33',
   'Filtre post-carbone pour l''affinage final du gout.',
   45, 'consommables', 'https://picsum.photos/seed/postcarb25/400/400',
   '["Taille: 10 pouces","Charbon actif","Duree: 12 mois","Ameliore le gout"]'::jsonb,
   false, 40, 10, 12)
ON CONFLICT (slug) DO NOTHING;

-- Profil société
INSERT INTO company_profile (name, legal_name, capital, address, phone, email)
VALUES ('EAUMALIK SARL', 'EAUMALIK S.A.R.L.', 100000.00,
        '23 Rue Boured Eig 3, N5 Roches Noires, Casablanca',
        '+212 661 463 194', 'eaumaliksarl@gmail.com')
ON CONFLICT DO NOTHING;
