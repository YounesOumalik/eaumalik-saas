// Données mock — utilisées quand NEXT_PUBLIC_USE_MOCKS=true (dev sans Supabase).
// Reprenez exactement la même forme que les types `Product | Order | ...`
import type {
  Product, Order, OrderItem, User, MaintenanceAlert, CompanyProfile,
} from '@/types';

export const MOCK_COMPANY: CompanyProfile = {
  id: 'c0000000-0000-0000-0000-000000000001',
  name: 'EAUMALIK SARL',
  legal_name: 'EAUMALIK S.A.R.L.',
  capital: 100000,
  address: '23 Rue Boured Eig 3, N5 Roches Noires, Casablanca',
  phone: '+212 661 463 194',
  email: 'eaumaliksarl@gmail.com',
  fax: '0520927192',
  if_number: null,
  tax_id: null,
  rc_number: null,
  logo_url: null,
  created_at: '2025-01-01T00:00:00Z',
};

const NOW = '2025-03-05T00:00:00Z';

export const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: "ECO LIFE Purificateur d'Eau", slug: 'eco-life-purificateur',
    description: "Purificateur d'eau haute performance avec systeme de filtration a 6 etapes.",
    price: 1999, category: 'purificateurs', image_url: 'https://picsum.photos/seed/ecolife2025/400/400',
    specs: ['Debit: 75 GPD', '6 etapes de filtration', 'Reservoir 10L', 'Tension: 220V', 'Garantie 1 an'],
    is_featured: true, stock: 15, stock_alert_threshold: 5, filter_lifespan_months: null,
    created_at: NOW, updated_at: NOW },
  { id: 'p2', name: 'GIZA Purificateur Osmose Inverse', slug: 'giza-osmose-inverse',
    description: "Purificateur a osmose inverse avec technologie avancee.",
    price: 1999, category: 'purificateurs', image_url: 'https://picsum.photos/seed/giza2025/400/400',
    specs: ['Debit: 75 GPD', 'Osmose inverse', '6 etapes de filtration', 'Garantie 1 an'],
    is_featured: true, stock: 8, stock_alert_threshold: 5, filter_lifespan_months: null,
    created_at: NOW, updated_at: NOW },
  { id: 'p3', name: 'OSMOSEUR COMPACT PREMIUM', slug: 'osmoseur-compact-premium',
    description: 'Osmoseur compact haut de gamme avec 7 etapes de filtration.',
    price: 1999, category: 'purificateurs', image_url: 'https://picsum.photos/seed/osmoprem/400/400',
    specs: ['Debit: 75 GPD', '7 etapes', 'Elimination 99% impuretes', 'Design premium rouge'],
    is_featured: true, stock: 12, stock_alert_threshold: 5, filter_lifespan_months: null,
    created_at: NOW, updated_at: NOW },
  { id: 'p4', name: 'Station Osmose Inverse Industrielle', slug: 'station-osmose-industrielle',
    description: "Station de traitement d'eau industrielle par osmose inverse.",
    price: 24999, category: 'industriel', image_url: 'https://picsum.photos/seed/industriel2025/400/400',
    specs: ['Debit: 400 GPD', 'Industrielle', 'Elimination 99%', 'Panneau de controle'],
    is_featured: false, stock: 3, stock_alert_threshold: 2, filter_lifespan_months: null,
    created_at: NOW, updated_at: NOW },
  { id: 'p5', name: 'Filtre PP 5 microns', slug: 'filtre-pp-5um',
    description: 'Cartouche de filtration sedimentaire PP 5 microns.',
    price: 49, category: 'consommables', image_url: 'https://picsum.photos/seed/filterpp25/400/400',
    specs: ['Taille: 10 pouces', 'Finesse: 5um', 'Duree de vie: 6 mois'],
    is_featured: false, stock: 50, stock_alert_threshold: 10, filter_lifespan_months: 6,
    created_at: NOW, updated_at: NOW },
  { id: 'p6', name: 'Filtre GAC (Charbon Actif)', slug: 'filtre-gac',
    description: 'Cartouche GAC pour elimination du chlore, odeurs et composes organiques.',
    price: 59, category: 'consommables', image_url: 'https://picsum.photos/seed/filtergac25/400/400',
    specs: ['Charbon actif', 'Duree: 12 mois', 'Tous modeles'],
    is_featured: false, stock: 45, stock_alert_threshold: 10, filter_lifespan_months: 12,
    created_at: NOW, updated_at: NOW },
  { id: 'p7', name: "Membrane d'Osmose 75 GPD", slug: 'membrane-osmose-75gpd',
    description: "Membrane d'osmose inverse 75 gallons par jour.",
    price: 299, category: 'consommables', image_url: 'https://picsum.photos/seed/membrane75/400/400',
    specs: ['Debit: 75 GPD', 'Rejet: 98%', 'Duree: 24 mois'],
    is_featured: false, stock: 20, stock_alert_threshold: 5, filter_lifespan_months: 24,
    created_at: NOW, updated_at: NOW },
  { id: 'p8', name: 'Filtre Post-Carbone T33', slug: 'filtre-post-carbone-t33',
    description: "Filtre post-carbone pour l'affinage final du gout.",
    price: 45, category: 'consommables', image_url: 'https://picsum.photos/seed/postcarb25/400/400',
    specs: ['Charbon actif', 'Duree: 12 mois', 'Ameliore le gout'],
    is_featured: false, stock: 40, stock_alert_threshold: 10, filter_lifespan_months: 12,
    created_at: NOW, updated_at: NOW },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', email: 'm.alami@email.com',    full_name: 'Mohammed Alami',        avatar_url: null, phone: '0661234567', address: null, city: 'Casablanca', google_id: null, role: 'client', nps_score: 9,    created_at: NOW, updated_at: NOW },
  { id: 'u2', email: 'fz.bennani@email.com', full_name: 'Fatima Zahra Bennani', avatar_url: null, phone: '0677654321', address: null, city: 'Rabat',      google_id: null, role: 'client', nps_score: 10,   created_at: NOW, updated_at: NOW },
  { id: 'u3', email: 'k.tazi@email.com',     full_name: 'Karim Tazi',           avatar_url: null, phone: '0699887766', address: null, city: 'Marrakech',  google_id: null, role: 'client', nps_score: 8,    created_at: NOW, updated_at: NOW },
  { id: 'u4', email: 'a.cherkaoui@email.com',full_name: 'Amina Cherkaoui',      avatar_url: null, phone: '0611223344', address: null, city: 'Fes',        google_id: null, role: 'client', nps_score: 7,    created_at: NOW, updated_at: NOW },
  { id: 'u5', email: 'y.elfassi@email.com',  full_name: 'Youssef El Fassi',     avatar_url: null, phone: '0655443322', address: null, city: 'Tanger',     google_id: null, role: 'client', nps_score: null, created_at: NOW, updated_at: NOW },
  { id: 'u6', email: 'h.moussaoui@email.com',full_name: 'Hassan Moussaoui',     avatar_url: null, phone: '0677889900', address: null, city: 'Casablanca', google_id: null, role: 'client', nps_score: 9,    created_at: NOW, updated_at: NOW },
  { id: 'u7', email: 'n.berrada@email.com',  full_name: 'Nadia Berrada',        avatar_url: null, phone: '0622334455', address: null, city: 'Meknes',     google_id: null, role: 'client', nps_score: null, created_at: NOW, updated_at: NOW },
  { id: 'admin', email: 'eaumaliksarl@gmail.com', full_name: 'Admin EAUMALIK', avatar_url: null, phone: '+212 661 463 194', address: null, city: 'Casablanca', google_id: null, role: 'admin', nps_score: null, created_at: NOW, updated_at: NOW },
];

export const MOCK_ORDERS: Order[] = [
  { id: 'o1', order_number: 'CMD-2025-001', user_id: 'u1', client_name: 'Mohammed Alami',         client_phone: '0661234567', client_address: 'Bd Zerktouni, Apt 12',    client_city: 'Casablanca', status: 'livree',       subtotal: 1999, delivery_fee: 0,    total: 1999,  notes: null, payment_method: 'cash_on_delivery', invoice_generated: true,  created_at: '2025-01-15T00:00:00Z', updated_at: '2025-01-15T00:00:00Z' },
  { id: 'o2', order_number: 'CMD-2025-002', user_id: 'u2', client_name: 'Fatima Zahra Bennani',  client_phone: '0677654321', client_address: '15 Rue Agdal, Hay Riad',  client_city: 'Rabat',      status: 'en_livraison', subtotal: 2048, delivery_fee: 10,   total: 2058,  notes: null, payment_method: 'cash_on_delivery', invoice_generated: false, created_at: '2025-01-22T00:00:00Z', updated_at: '2025-01-22T00:00:00Z' },
  { id: 'o3', order_number: 'CMD-2025-003', user_id: 'u3', client_name: 'Karim Tazi',            client_phone: '0699887766', client_address: 'Av Mohammed V, Gueliz',  client_city: 'Marrakech',  status: 'traitee',      subtotal: 24999, delivery_fee: 0,   total: 24999, notes: null, payment_method: 'cash_on_delivery', invoice_generated: false, created_at: '2025-02-03T00:00:00Z', updated_at: '2025-02-03T00:00:00Z' },
  { id: 'o4', order_number: 'CMD-2025-004', user_id: 'u4', client_name: 'Amina Cherkaoui',       client_phone: '0611223344', client_address: '32 Ave Hassan II',        client_city: 'Fes',        status: 'en_attente',   subtotal: 439,  delivery_fee: 13,   total: 452,   notes: null, payment_method: 'cash_on_delivery', invoice_generated: false, created_at: '2025-02-10T00:00:00Z', updated_at: '2025-02-10T00:00:00Z' },
  { id: 'o5', order_number: 'CMD-2025-005', user_id: 'u5', client_name: 'Youssef El Fassi',      client_phone: '0655443322', client_address: 'Bd Pasteur, Res Nour',    client_city: 'Tanger',     status: 'en_attente',   subtotal: 1999, delivery_fee: 0,    total: 1999,  notes: null, payment_method: 'cash_on_delivery', invoice_generated: false, created_at: '2025-02-14T00:00:00Z', updated_at: '2025-02-14T00:00:00Z' },
  { id: 'o6', order_number: 'CMD-2025-006', user_id: 'u4', client_name: 'Sara Benjelloun',       client_phone: '0633445566', client_address: '45 Rue Ibn Batouta',      client_city: 'Agadir',     status: 'annulee',      subtotal: 344,  delivery_fee: 4,    total: 348,   notes: null, payment_method: 'cash_on_delivery', invoice_generated: false, created_at: '2025-02-18T00:00:00Z', updated_at: '2025-02-18T00:00:00Z' },
  { id: 'o7', order_number: 'CMD-2025-007', user_id: 'u6', client_name: 'Hassan Moussaoui',      client_phone: '0677889900', client_address: '18 Rue de Fes, Maarif',   client_city: 'Casablanca', status: 'livree',       subtotal: 2152, delivery_fee: 145,  total: 2297,  notes: null, payment_method: 'cash_on_delivery', invoice_generated: true,  created_at: '2025-03-01T00:00:00Z', updated_at: '2025-03-01T00:00:00Z' },
  { id: 'o8', order_number: 'CMD-2025-008', user_id: 'u7', client_name: 'Nadia Berrada',         client_phone: '0622334455', client_address: '7 Ave Moulay Ismail',     client_city: 'Meknes',     status: 'en_livraison', subtotal: 1999, delivery_fee: 0,    total: 1999,  notes: null, payment_method: 'cash_on_delivery', invoice_generated: false, created_at: '2025-03-05T00:00:00Z', updated_at: '2025-03-05T00:00:00Z' },
];

export const MOCK_ORDER_ITEMS: OrderItem[] = [
  { id: 'oi1',  order_id: 'o1', product_id: 'p1', product_name: "ECO LIFE Purificateur d'Eau",    unit_price: 1999, quantity: 1, line_total: 1999 },
  { id: 'oi2',  order_id: 'o2', product_id: 'p2', product_name: 'GIZA Purificateur Osmose Inverse', unit_price: 1999, quantity: 1, line_total: 1999 },
  { id: 'oi3',  order_id: 'o2', product_id: 'p5', product_name: 'Filtre PP 5 microns',           unit_price: 49,   quantity: 1, line_total: 49 },
  { id: 'oi4',  order_id: 'o3', product_id: 'p4', product_name: 'Station Osmose Inverse Industrielle', unit_price: 24999, quantity: 1, line_total: 24999 },
  { id: 'oi5',  order_id: 'o4', product_id: 'p5', product_name: 'Filtre PP 5 microns',           unit_price: 49,   quantity: 3, line_total: 147 },
  { id: 'oi6',  order_id: 'o4', product_id: 'p6', product_name: 'Filtre GAC (Charbon Actif)',    unit_price: 59,   quantity: 3, line_total: 177 },
  { id: 'oi7',  order_id: 'o4', product_id: 'p8', product_name: 'Filtre Post-Carbone T33',       unit_price: 45,   quantity: 2, line_total: 90 },
  { id: 'oi8',  order_id: 'o5', product_id: 'p3', product_name: 'OSMOSEUR COMPACT PREMIUM',      unit_price: 1999, quantity: 1, line_total: 1999 },
  { id: 'oi9',  order_id: 'o6', product_id: 'p7', product_name: "Membrane d'Osmose 75 GPD",       unit_price: 299,  quantity: 1, line_total: 299 },
  { id: 'oi10', order_id: 'o6', product_id: 'p8', product_name: 'Filtre Post-Carbone T33',       unit_price: 45,   quantity: 1, line_total: 45 },
  { id: 'oi11', order_id: 'o7', product_id: 'p1', product_name: "ECO LIFE Purificateur d'Eau",   unit_price: 1999, quantity: 1, line_total: 1999 },
  { id: 'oi12', order_id: 'o7', product_id: 'p6', product_name: 'Filtre GAC (Charbon Actif)',     unit_price: 59,   quantity: 1, line_total: 59 },
  { id: 'oi13', order_id: 'o7', product_id: 'p5', product_name: 'Filtre PP 5 microns',            unit_price: 49,   quantity: 1, line_total: 49 },
  { id: 'oi14', order_id: 'o7', product_id: 'p8', product_name: 'Filtre Post-Carbone T33',       unit_price: 45,   quantity: 1, line_total: 45 },
  { id: 'oi15', order_id: 'o8', product_id: 'p2', product_name: 'GIZA Purificateur Osmose Inverse', unit_price: 1999, quantity: 1, line_total: 1999 },
];

export const MOCK_MAINTENANCE: MaintenanceAlert[] = [
  { id: 'm1', user_id: 'u1', order_id: 'o1', product_id: 'p1', product_name: "ECO LIFE Purificateur d'Eau", install_date: '2023-02-15', next_filter_change: '2025-02-15', filter_types: ['PP 5um', 'GAC', 'Post-Carbone'], status: 'expire',         last_reminder_sent: null, created_at: '2023-02-15T00:00:00Z', updated_at: '2025-02-15T00:00:00Z' },
  { id: 'm2', user_id: 'u2', order_id: 'o2', product_id: 'p2', product_name: 'GIZA Purificateur Osmose Inverse', install_date: '2024-01-22', next_filter_change: '2025-01-22', filter_types: ['PP 5um', 'GAC', 'Membrane 75 GPD', 'Post-Carbone'], status: 'expire',         last_reminder_sent: null, created_at: '2024-01-22T00:00:00Z', updated_at: '2025-01-22T00:00:00Z' },
  { id: 'm3', user_id: 'u3', order_id: 'o3', product_id: 'p4', product_name: 'Station Osmose Inverse Industrielle', install_date: '2024-06-01', next_filter_change: '2025-06-01', filter_types: ['Pre-filtre industriel', 'Membrane 400 GPD'], status: 'a_renouveler',    last_reminder_sent: null, created_at: '2024-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z' },
  { id: 'm4', user_id: 'u4', order_id: null, product_id: 'p1', product_name: "ECO LIFE Purificateur d'Eau", install_date: '2024-08-20', next_filter_change: '2025-08-20', filter_types: ['PP 5um', 'GAC', 'Post-Carbone'], status: 'a_jour',         last_reminder_sent: null, created_at: '2024-08-20T00:00:00Z', updated_at: '2024-08-20T00:00:00Z' },
  { id: 'm5', user_id: 'u6', order_id: 'o7', product_id: 'p1', product_name: "ECO LIFE Purificateur d'Eau", install_date: '2024-03-01', next_filter_change: '2025-03-01', filter_types: ['PP 5um', 'GAC', 'Post-Carbone'], status: 'expire',         last_reminder_sent: null, created_at: '2024-03-01T00:00:00Z', updated_at: '2025-03-01T00:00:00Z' },
  { id: 'm6', user_id: 'u7', order_id: 'o8', product_id: 'p2', product_name: 'GIZA Purificateur Osmose Inverse', install_date: '2025-03-05', next_filter_change: '2026-03-05', filter_types: ['PP 5um', 'GAC', 'Membrane 75 GPD', 'Post-Carbone'], status: 'a_jour', last_reminder_sent: null, created_at: '2025-03-05T00:00:00Z', updated_at: '2025-03-05T00:00:00Z' },
];

// Helpers d'accès aux mocks (utilisé par les repositories serveur).
export const REPOSITORY = {
  products: MOCK_PRODUCTS,
  users: MOCK_USERS,
  orders: MOCK_ORDERS,
  orderItems: MOCK_ORDER_ITEMS,
  maintenance: MOCK_MAINTENANCE,
  company: MOCK_COMPANY,
};
